const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");
const fsPromises = fs.promises;
const execPromise = util.promisify(exec);
const { deduplicateVideo } = require('./videoTransformDeduplication.js');

// 格式化成为 YYYY-MM-DD 的字符串
const formatDate = () => {
  const date = new Date();
  return (
    date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + "-" + date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds()
  );
};



const scriptDir = path.dirname(__filename);
// return;
// 映射图谱
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
    deduplicationConfig
  } = basicVideoInfoObj;
  scalePercent = scalePercent / 100;

  let {
    musicFilePath,
    videoFolderPath,
    newVideoFolderPath,
    newFolderYiFaPath
  } = pathInfoObj


  const fileExt = path.extname(filePath);
  let originFileName = path.basename(filePath, path.extname(filePath));
  // 如果文件名包含#
  let fileName = ''
  if (originFileName.includes("#")) {
    // 默认#标签在描述说明后面
    const fileSplit = originFileName.split("-")
    let nickName = fileSplit[0];
    const year = fileSplit[fileSplit.length - 3]
    const month = fileSplit[fileSplit.length - 2]
    const day = fileSplit[fileSplit.length - 1].split(' ')[0]
    let publishTime = `${year}-${month}-${day}`
    fileName = originFileName.split("#")[0];
    fileName = fileName.split("-")[1];
    if (fileName == "") {
      const arr = originFileName.split("#")
      fileName = arr[arr.length - 1];
      fileName = fileName.split("-")[0];
      // TODO 接入deepSeek AI改名，生成新的爆款自媒体标题

    }
    // 如果取出desc描述不包含游戏名则最前面添加游戏名
    if (!fileName?.includes(gameName) && groupName === '攻略') fileName = `${fileName}~${gameName}`
  } else {
    fileName = originFileName
  }
  let tempFileName = groupName === '攻略' ? fileName : fileName + '_' + publishTime;

  if (checkName) {
    return console.log(tempFileName);
  }
  if (onlyRename) {
    const finalGameVideoScrPath = path.join(videoFolderPath, `/已重命名处理`)
    const finalGameVideoScrYiFaPath = path.join(videoFolderPath, `/已重命名处理/已发`)
    // 判断是否存在已处理文件夹,不存在则创建
    if (!fs.existsSync(finalGameVideoScrPath)) {
      fs.mkdirSync(finalGameVideoScrPath);
      fs.mkdirSync(finalGameVideoScrYiFaPath);
    }

    // 如果重命名后（部分作者不标标题）存在同名文件，先替换一下tempFileName
    const finalGameVideoPath = path.join(videoFolderPath, `/已重命名处理/${tempFileName}${fileExt}`)
    fs.renameSync(filePath, finalGameVideoPath);
    fileNameMap[originFileName] = tempFileName;
    return;
  }


  const videoTempPath = path.join(
    videoFolderPath,
    `${tempFileName}_temp${fileExt}`
  );


  const finalNoMusicVideoPath = path.join(
    videoFolderPath,
    `${tempFileName}_final${fileExt}`
  );
  const fileListPath = path.join(videoFolderPath, `${tempFileName}_filelist.txt`);
  const gameVideoPath = path.join(
    videoFolderPath,
    `${tempFileName}_game${fileExt}`
  );
  const gameFileListPath = path.join(
    videoFolderPath,
    `${tempFileName}_game_filelist.txt`
  );


  //  剩下都是非攻略  coser转换的
  if (!fs.existsSync(newVideoFolderPath)) {
    fs.mkdirSync(newVideoFolderPath);
    fs.mkdirSync(newFolderYiFaPath);
    fs.mkdirSync(path.join(newVideoFolderPath, `/合集`));
  }



  async function deleteTempFile() {
    if (fs.existsSync(fileListPath)) await fsPromises.unlink(fileListPath);
    // if (fs.existsSync(videoTempPath)) await fsPromises.unlink(videoTempPath);  //最后删除  30S合并需要使用
    if (fs.existsSync(finalNoMusicVideoPath))
      await fsPromises.unlink(finalNoMusicVideoPath);
    if (fs.existsSync(gameVideoPath)) await fsPromises.unlink(gameVideoPath);
    if (fs.existsSync(gameFileListPath))
      await fsPromises.unlink(gameFileListPath);
    if (
      fs.existsSync(`${finalNoMusicVideoPath.replace("_final", "_game_final")}`)
    )
      await fsPromises.unlink(
        `${finalNoMusicVideoPath.replace("_final", "_game_final")}`
      );
  }

  await deleteTempFile(); // 先删除之前的文件，避免ffmpeg卡住

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

  const finalVideoPath = path.join(newVideoFolderPath, `${tempFileName}${fileExt}`);
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

  // 在处理完基本的视频操作后，如果有去重配置则进行去重处理
  if (deduplicationConfig && deduplicationConfig.enable && Object.keys(deduplicationConfig).length > 0) {
    try {
      await deduplicateVideo(finalVideoPath, deduplicationConfig);
      console.log(`视频去重处理完成: ${finalVideoPath}`);
    } catch (error) {
      console.error(`视频去重处理失败: ${error.message}`);
    }
  }

  const originNewFilePath = path.join(
    newVideoFolderPath,
    `${originFileName}${fileExt}`
  );
  fs.renameSync(filePath, originNewFilePath); // coser 不移动原始文件，方便后续重复制作爆款
  fileNameMap[originFileName] = fileName;



  return await deleteTempFile();



  // 新的CG处理逻辑：生成 > n秒的视频，原视频 + 游戏随机片段 
  const gameFragmentFilePath = path.join(scriptDir, `./gameFragment${w_h}.mp4`); // 游戏片段文件路径
  const randomStartTime = Math.floor(Math.random() * 120 + 5); //
  // 步骤1：截取游戏片段的随机24秒
  const command4 = `ffmpeg  -ss ${randomStartTime}  -i "${gameFragmentFilePath}"   -t 24 -c:v copy -an "${gameVideoPath}"`;
  await runFFmpegCommand(command4);
  // 步骤2：生成 game_filelist.txt 等待合并文件
  const gameFilelistContent = `file '${videoTempPath}'\nfile '${gameVideoPath}'`;
  fs.writeFileSync(gameFileListPath, gameFilelistContent);
  // 步骤3：合并视频和游戏片段并静音（方便后续合并音频）
  const command5 = `ffmpeg -f concat -safe 0 -i "${gameFileListPath}" -c copy -an "${finalNoMusicVideoPath.replace(
    "_final",
    "_game_final"
  )}"`;
  await runFFmpegCommand(command5);
  // 合并音频
  const command5t = `ffmpeg -i "${finalNoMusicVideoPath.replace(
    "_final",
    "_game_final"
  )}" -i "${musicFilePath}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${finalNoMusicVideoPath.replace(
    "_final",
    "_game_final_music"
  )}"`;
  await runFFmpegCommand(command5t);
  await deleteTempFile();
  return;
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
  enableMerge: false,     // 新增：是否启用合并
  mergedLimitTime: 20     // 新增：合并时长限制
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
    mergedLimitTime
  } = basicVideoInfoObj;

  // 初始化合并视频信息对象
  const mergeVideoInfoObj = {
    mergedLimitTime: mergedLimitTime || 20,
    videoIndex: 0,
    totalDuration: 0,
    fileStr: '',
    needMergeBiliBiliVideoPath: [],  // 后续合并
    needDeleteTempFilePath: []  // 后续删除
  }

  const musicFilePath = path.join(scriptDir, `./素材/music/${musicName}.mp3`); // 音乐文件路径,优先foldPath下的music文件夹，其次读取根目录下的素材/music文件夹里的随机mp3文件
  const foldPath = `${gameName}/${groupName}`;
  const videoFolderPath = path.join(scriptDir, `gameList/${foldPath}`);
  const newVideoFolderPath = path.join(videoFolderPath, formatDate() + `_截取${beforeTime}秒后_${replaceMusic ? `音乐=${musicName}` : ''}缩放${scalePercent}%_合集时间大于${mergeVideoInfoObj.mergedLimitTime}_帧数=${fps}`);
  const newFolderYiFaPath = path.join(newVideoFolderPath + '/已发'); // 默认在日期下生成已发文件夹，抽查播放完成后放进去, 识别

  const pathInfoObj = {
    musicFilePath,
    foldPath,
    videoFolderPath,
    newVideoFolderPath,
    newFolderYiFaPath
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

    }
    // 删除临时文件
    await Promise.all(mergeVideoInfoObj.needDeleteTempFilePath.map(async (filePath) => {
      return await fsPromises.unlink(filePath);
    }))

    // 将文件名映射保存为 JSON 文件
    fs.writeFileSync(mapFilePath, JSON.stringify(fileNameMap, null, 2));
  } catch (err) {
    console.error("主程序执行出错: " + err);
    fs.writeFileSync(mapFilePath, JSON.stringify(fileNameMap, null, 2));
  }
}

// ffmpegHandleVideos({
//     onlyRename: false,
//     checkName: false,
//     beforeTime: 1,
//     fps: 30,
//     scalePercent: 0,
//     replaceMusic: false, //  合集是否替换音乐
//     musicName: 'billll', //  coser必定替换音乐 ?
//     gameName: '航海王壮志雄心', //   
//     groupName: 'coser同行',  //   
// }).catch((err) => {
//     console.error("主程序执行出错: " + err);
// });

module.exports = {
  ffmpegHandleVideos
}