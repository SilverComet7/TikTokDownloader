const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const fsPromises = fs.promises;
const execPromise = util.promisify(exec);
const { deduplicateVideo } = require('./videoTransformDeduplication.js');

// 格式化成为 YYYY-MM-DD HH:mm:ss 的字符串
const formatDate = () => {
  const date = new Date();
  return (
    date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds()
  );
};

const scriptDir = path.dirname(__filename);
const mapName = "reNameMap.json";
let fileNameMap = {};
const mapFilePath = path.join(scriptDir, "gameList/" + mapName);
if (fs.existsSync(mapFilePath)) {
  try {
    fileNameMap = JSON.parse(fs.readFileSync(mapFilePath, "utf8"));
  } catch (err) {
    console.error(`读取映射文件时出错: ${err.message}`);
    fileNameMap = {};
  }
}


// 瓜分奖励查看人数计算性价比
// 爆款视频重复投递策略   title+封面+投稿时间点+Tag
let w_h = "_9_16";

async function runFFmpegCommand(command) {
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      // console.warn(`FFmpeg警告输出: ${stderr}`);
    }
    // console.log(`FFmpeg标准输出: ${stdout}`);
  } catch (error) {
    console.error(`执行命令时出错: ${error.message}`);
    console.error(`FFmpeg标准错误输出: ${error.stderr}`);
    throw error;
  }
}

async function getVideoParams(filePath) {
  try {
    const command = `ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,duration  -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const { stdout, stderr } = await execPromise(command);

    if (stderr) {
      console.error(`FFmpeg标准错误输出: ${stderr}`);
    }

    const [codecName, width, height, frameRate, duration] = stdout.trim().split("\n");
    return { codecName, width: parseInt(width), height: parseInt(height), frameRate: parseInt(frameRate), duration: parseInt(duration) };
  } catch (error) {
    console.error(`执行命令时出错: ${error.message}`);
    throw error;
  }
}

async function processVideo(filePath, basicVideoInfoObj,
  pathInfoObj, mergeVideoInfoObj) {

  let {
    onlyRename,
    checkName,
    beforeTime,
    fps,
    scalePercent,
    replaceMusic,
    gameName,
    groupName,
    deduplicationConfig,
    addPublishTime
  } = basicVideoInfoObj;
  scalePercent = scalePercent / 100;

  let {
    musicFilePath,
    videoFolderPath,
    newVideoFolderPath,
    newFolderYiFaPath,
    newOriginalFolderPath
  } = pathInfoObj

  const fileExt = path.extname(filePath);
  let originFileName = path.basename(filePath, path.extname(filePath));

  // nickName desc publishTime 格式的重命名
  
  let fileName = ''
  const fileSplit = originFileName.split("-")
  let nickName = fileSplit[0];
  let publishTime = ''
  if (originFileName.includes("#")) {
    publishTime = fileSplit.slice(-3).join('-')
    fileName = originFileName.split("#")[0];
    fileName = fileName.split("-")[1];
    if (fileName == "") {
      const arr = originFileName.split("#")
      fileName = arr[arr.length - 1];
      fileName = fileName.split("-")[0];
      // TODO 接入deepSeek AI改名，生成新的爆款自媒体标题

    }
    if (!fileName?.includes(gameName) && groupName === '攻略') fileName = `${fileName}~${gameName}`
  } else {
    fileName = originFileName
  }

  if (addPublishTime && publishTime) {
    fileName = fileName + '_' + publishTime;
  }

  // desc 格式的重命名




  if (checkName) {
    return console.log(fileName);
  }

  

  if (onlyRename) {
    const finalGameVideoScrPath = path.join(videoFolderPath, `/已重命名处理`)
    const finalGameVideoScrYiFaPath = path.join(videoFolderPath, `/已重命名处理/已发`)
    // 判断是否存在已处理文件夹,不存在则创建
    if (!fs.existsSync(finalGameVideoScrPath)) {
      fs.mkdirSync(finalGameVideoScrPath);
      fs.mkdirSync(finalGameVideoScrYiFaPath);
    }

    const finalGameVideoPath = path.join(videoFolderPath, `/已重命名处理/${fileName}${fileExt}`)
    fs.renameSync(filePath, finalGameVideoPath);
    fileNameMap[originFileName] = fileName;
    return;
  }

  //  剩下都是非攻略  coser转换的
  const videoTempPath = path.join(
    videoFolderPath,
    `${fileName}_temp${fileExt}`
  );
  const finalNoMusicVideoPath = path.join(
    videoFolderPath,
    `${fileName}_final${fileExt}`
  );
  const fileListPath = path.join(videoFolderPath, `${fileName}_filelist.txt`);
  const gameFileListPath = path.join(
    videoFolderPath,
    `${fileName}_game_filelist.txt`
  );


  if (deduplicationConfig && deduplicationConfig.enable && Object.keys(deduplicationConfig).length > 0) {
    try {
      await deduplicateVideo(filePath, deduplicationConfig);
      console.log(`视频去重处理完成: ${filePath}`);
    } catch (error) {
      console.error(`视频去重处理失败: ${error.message}`);
    }
  }

  if (!fs.existsSync(newVideoFolderPath)) {
    fs.mkdirSync(newVideoFolderPath);
    fs.mkdirSync(newFolderYiFaPath);
    fs.mkdirSync(path.join(newVideoFolderPath, `/合集`)); // N s 合集文件夹
  }

  if (!fs.existsSync(newOriginalFolderPath)) {
    fs.mkdirSync(newOriginalFolderPath);
  }

  async function deleteTempFile(mergeVideoInfoObj) {
    if (fs.existsSync(fileListPath)) await fsPromises.unlink(fileListPath);
    if (fs.existsSync(finalNoMusicVideoPath))
      await fsPromises.unlink(finalNoMusicVideoPath);
    if (fs.existsSync(gameFileListPath))
      await fsPromises.unlink(gameFileListPath);
    if (
      fs.existsSync(`${finalNoMusicVideoPath.replace("_final", "_game_final")}`)
    )
      await fsPromises.unlink(
        `${finalNoMusicVideoPath.replace("_final", "_game_final")}`
      );
    // 存在合并视频信息对象时，不直接删除临时文件，最后合并后删除
    if (mergeVideoInfoObj) return;
    if (fs.existsSync(videoTempPath)) await fsPromises.unlink(videoTempPath);  //最后删除  30S合并需要使用
  }

  await deleteTempFile(mergeVideoInfoObj); // 先删除之前的文件，避免ffmpeg卡住

  // 调整videoParams的获取位置
  let videoParams = await getVideoParams(filePath);
  if (Number(videoParams.width) > Number(videoParams.height)) {
    w_h = "_16_9";
    scale = `scale=1920:1080`;
  } else {
    w_h = "_9_16";
    scale = `scale=1080:1920`;
  }
  if (scalePercent) scale = `scale=${videoParams.width * scalePercent}:${videoParams.height * scalePercent}`

  let command2 = ''
  if (groupName == "coser本人" || gameName == "coser本人") {
    // coser本人打上水印
    command2 = `ffmpeg -ss ${beforeTime}   -i "${filePath}"  -r ${fps} -vf "${scale},drawtext=fontfile='./SourceHanSansCN-Bold.otf':text='coser：${nickName}':fontsize=18:fontcolor=white:x=50:y=50" -c:v libx264 -c:a aac "${videoTempPath}"`;
  } else {
    command2 = `ffmpeg -ss ${beforeTime}   -i "${filePath}"  -r ${fps} -vf "${scale}" -c:v libx264 -c:a aac "${videoTempPath}"`;
  }
  await runFFmpegCommand(command2);
  // 只在mergeVideoInfoObj存在时执行合并相关操作
  if (mergeVideoInfoObj) {
    const videoTrueDuration = (videoParams.duration - beforeTime);
    mergeVideoInfoObj.totalDuration += videoTrueDuration
    mergeVideoInfoObj.fileStr += `file '${videoTempPath}'\n`;
    if (mergeVideoInfoObj.totalDuration > mergeVideoInfoObj.mergedLimitTime) {
      const txtPath = path.join(newVideoFolderPath, `/合集/${gameName}coser合集${mergeVideoInfoObj.videoIndex + 1}.0_filelist.txt`)
      const mp4File = path.join(newVideoFolderPath, `/合集/${gameName}coser合集${mergeVideoInfoObj.videoIndex + 1}.0.mp4`)
      fsPromises.writeFile(txtPath, mergeVideoInfoObj.fileStr);
      mergeVideoInfoObj.totalDuration = 0
      mergeVideoInfoObj.fileStr = ''
      mergeVideoInfoObj.videoIndex += 1
      mergeVideoInfoObj.needMergeBiliBiliVideoPath.push({
        txtPath,
        mp4File
      })
      mergeVideoInfoObj.needDeleteTempFilePath.push(txtPath)
    }
    mergeVideoInfoObj.needDeleteTempFilePath.push(videoTempPath)
  }

  // 步骤3：生成 filelist.txt
  const endingFilePath = path.join(scriptDir, `./素材/after/点赞关注${w_h}.mp4`);
  const filelistContentTest = `file '${videoTempPath}'\nfile '${endingFilePath}'`;
  fs.writeFileSync(fileListPath, filelistContentTest);

  const finalVideoPath = path.join(newVideoFolderPath, `${fileName}${fileExt}`);
  // 步骤4：合并视频和默认片尾
  let command3 = ''
  if (replaceMusic) {
    command3 = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy -an "${finalNoMusicVideoPath}"`;
    await runFFmpegCommand(command3);
    const command4t = `ffmpeg -i "${finalNoMusicVideoPath}" -i "${musicFilePath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${finalVideoPath}"`;
    await runFFmpegCommand(command4t);
  } else {
    command3 = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${finalVideoPath}"`;
    await runFFmpegCommand(command3);
  }


  if (fileName !== originFileName) {
    const originNewFilePath = path.join(
      newOriginalFolderPath,
      `${originFileName}${fileExt}`
    );
    fs.renameSync(filePath, originNewFilePath);
    fileNameMap[originFileName] = fileName;
  }

  return await deleteTempFile(mergeVideoInfoObj);

}


async function ffmpegHandleVideos(basicVideoInfoObj = {
  checkName: false,
  beforeTime: 1,
  fps: 30,
  scalePercent: 0,
  replaceMusic: false,
  musicName: 'billll',
  gameName: '崩坏3',
  groupName: 'coser本人',
  onlyRename: false,
  deduplicationConfig: null,
  enableMerge: false,     
  mergedLimitTime: 20,
  addPublishTime: false,  // 新增：是否添加发布时间参数
  videoDir: ''           
}) {
  let {
    checkName,
    beforeTime,
    fps,
    scalePercent,
    replaceMusic,
    musicName,
    gameName,
    groupName,
    enableMerge,
    mergedLimitTime,
    addPublishTime,     // 新增：解构发布时间参数
    videoDir            
  } = basicVideoInfoObj;

  // 初始化合并视频信息对象
  const mergeVideoInfoObj = {
    mergedLimitTime: mergedLimitTime || 30,
    videoIndex: 0,
    totalDuration: 0,
    fileStr: '',
    needMergeBiliBiliVideoPath: [],  // 后续合并
    needDeleteTempFilePath: []  // 后续删除
  }

  const musicFilePath = path.join(scriptDir, `./素材/music/${musicName}.mp3`); // 音乐文件路径,优先foldPath下的music文件夹，其次读取根目录下的素材/music文件夹里的随机mp3文件
  const foldPathName = `gameList/${gameName}/${groupName}`;
  const videoFolderPath = videoDir || path.join(scriptDir, `${foldPathName}`);

  const newVideoFolderPath = path.join(videoFolderPath, formatDate() + `_截取${beforeTime}秒后_${replaceMusic ? `音乐=${musicName}` : ''}缩放${scalePercent}%_合集时间大于${mergeVideoInfoObj.mergedLimitTime}_帧数=${fps}`);
  const newOriginalFolderPath = path.join(videoFolderPath + '/已处理');
  const newFolderYiFaPath = path.join(newVideoFolderPath + '/已发'); // 默认在日期下生成已发文件夹，抽查播放完成后放进去, 识别
  const pathInfoObj = {
    musicFilePath,
    videoFolderPath,
    newVideoFolderPath,
    newFolderYiFaPath,
    newOriginalFolderPath
  }
  try {
    const files = await fsPromises.readdir(videoFolderPath);
    const videoPromises = [];

    for (const file of files) {
      if (path.extname(file).toLowerCase() === ".mp4" || path.extname(file).toLowerCase() === ".mov") {
        const filePath = path.join(videoFolderPath, file);

        try {
          videoPromises.push(processVideo(filePath, basicVideoInfoObj,
            pathInfoObj, enableMerge ? mergeVideoInfoObj : null))  // 根据enableMerge决定是否传入mergeVideoInfoObj
        } catch (error) {
          console.error("处理视频出错:", error);
        }
      }
    }
    await Promise.all(videoPromises)
    if (checkName) return

    // 只在启用合并时执行合并操作
    if (enableMerge) {
      // 合并视频,合并音频
      await Promise.all(mergeVideoInfoObj.needMergeBiliBiliVideoPath.map(async ({ txtPath, mp4File }) => {
        let command = ''
        if (replaceMusic) {
          command = `ffmpeg -f concat -safe 0 -i "${txtPath}" -i "${musicFilePath}" -c copy -map 0:v:0 -map 1:a:0 -shortest "${mp4File}"`;
        } else {
          command = `ffmpeg -f concat -safe 0 -i "${txtPath}" -c copy "${mp4File}"`;
        }
        return await runFFmpegCommand(command);
      }))
      // 删除临时文件
      await Promise.all(mergeVideoInfoObj.needDeleteTempFilePath.map(async (filePath) => {
        return await fsPromises.unlink(filePath);
      }))
    }

    // 将文件名映射保存为 JSON 文件
    fs.writeFileSync(mapFilePath, JSON.stringify(fileNameMap, null, 2));
  } catch (err) {
    console.error("主程序执行出错: " + err);
    fs.writeFileSync(mapFilePath, JSON.stringify(fileNameMap, null, 2));
  }
}


module.exports = {
  ffmpegHandleVideos
}