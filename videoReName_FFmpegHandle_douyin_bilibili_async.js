const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");

const fsPromises = fs.promises;
const execPromise = util.promisify(exec);

// 格式化成为 YYYY-MM-DD 的字符串
const formatDate = () => {
    const date = new Date();
    return (
        date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate()
    );
};



const scriptDir = path.dirname(__filename);

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



// TODO 
// 瓜分奖励查看人数计算性价比
// 爆款视频重复投递策略   title+封面+投稿时间点+Tag
// 1. 命令行可选此次批量转换的分辨率
// 2. 命令行可选此次是否需要启用的去重策略

let w_h = "_9_16";
const checkName = false  // 测试名称是否正确时启用


// 命令行控制转换逻辑,useDefault则使用默认参数，否则自己选
let useDefault = true;
let beforeTime = 1  // 截取第几s之后的画面
let fps = 30;
let scalePercent = 0.9;  // 缩放比  为0取此次命令行输入的默认scale  1920x1080  1080x1920
let replaceMusic = false; // 是否替换BGM，  相同素材多合集必定替换，素材丰富可自由合并
const videoInfoObj = {
    mergedLimitTime: 60,
    videoIndex: 0,
    totalDuration: 0,
    fileStr: '',
    needMergeBiliBiliVideoPath: [],  // 后续合并
    needDeleteTempFilePath: []  // 后续删除
}
// coser视频不移动原始视频，方便重复制作（文件夹命名），爆款保留重复制作(去重,BGM替换)，低质量移除到另一个文件夹，当存在多个视频时，随机跳过，以期望能达到不同的合集效果
const musicName = '难却'
const musicFilePath = path.join(scriptDir, `./素材/music/${musicName}.mp3`); // 音乐文件路径,优先foldPath下的music文件夹，其次读取根目录下的素材/music文件夹里的随机mp3文件
// const musicFilePath = path.join(scriptDir, "./music.mp3"); // 音乐文件路径,优先foldPath下的music文件夹，其次读取根目录下的素材/music文件夹里的随机mp3文件
const gameName = '以闪亮之名'
const groupName = `coser同行`   // 1. coser本人  2. coser同行 3. 攻略
const foldPath = `${gameName}/${groupName}`;
const gameFoldPath = path.join(scriptDir, `gameList/`);
const videoFolderPath = path.join(scriptDir, `gameList/${foldPath}`);
const newVideoFolderPath = path.join(videoFolderPath, formatDate() + `_beforeTime=${beforeTime}s_fps=${fps}_scalePercent=${scalePercent}%${replaceMusic ? `musicName=${musicName}` : ''}_mergedLimitTime=${videoInfoObj.mergedLimitTime}`);
const newFolderYiFaPath = path.join(newVideoFolderPath + '/已发'); // 默认在日期下生成已发文件夹，抽查播放完成后放进去, 识别




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

async function processVideo(filePath, videoParams, biliObj) {
    let originFileName = path.basename(filePath, path.extname(filePath));
    // 默认#标签在描述说明后面
    let nickName = originFileName.split("-")[0];
    fileName = originFileName.split("#")[0];
    fileName = fileName.split("-")[1];
    if (fileName == "") {
        // #标签在描述说明前面
        const arr = originFileName.split("#")
        fileName = arr[arr.length - 1];
        fileName = fileName.split("-")[0];
        // TODO 接入AI改名，生成新的爆款，固定标题不用
    }
    // 如果取出desc描述不包含游戏名则最前面添加游戏名
    if (!fileName?.includes(gameName) && groupName === '攻略') fileName = `【${gameName}】${fileName}`
    // 检查转移过去的文件是否有同名,有则加个时间
    if (fs.existsSync(path.join(newVideoFolderPath, fileName + '.mp4'))) {
        fileName = fileName + '_' + new Date().getTime();
    }
    if (!fileName) fileName = originFileName + '_' + new Date().getTime()
    let tempFileName = groupName === '攻略' ? fileName : fileName + '_' + new Date().getTime();

    const fileExt = path.extname(filePath);
    const videoTempPath = path.join(
        videoFolderPath,
        `${tempFileName}_temp${fileExt}`
    );
    if (checkName) {
        return console.log(fileName);
    }
    if (!fs.existsSync(newVideoFolderPath)) {
        fs.mkdirSync(newVideoFolderPath);
        fs.mkdirSync(newFolderYiFaPath);
    }
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



    if (groupName === '攻略') {
        // 如果存在同名，替换一下tempFileName
        const finalGameVideoPath = path.join(videoFolderPath, `${tempFileName}${fileExt}`)
        // 攻略类别只替换名称
        fs.renameSync(filePath, finalGameVideoPath);
        fileNameMap[originFileName] = fileName;
        return;
    }

    //  剩下都是非攻略  coser转换的




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


    // 缩放分辨率
    if (Number(videoParams.width) > Number(videoParams.height)) {
        w_h = "_16_9";
        scale = `scale=1920:1080`;
        // scale = `1440:1080`;
        // scale = `960:720`;
        // scale = `1280:720`;
        // scale = `1420:720`;
        // scale = `scale=iw*1080/ih:1080`;
    } else {
        w_h = "_9_16";
        scale = `scale=1080:1920`;
        // scale = `1080:1440`;
        // scale = `720:960`;
        // scale = `720:1280`;
        // scale = `720:1420`;
        // scale = `scale=iw*1920/ih:1920`;
    }
    if (scalePercent) scale = `scale=${videoParams.width * scalePercent}:${videoParams.height * scalePercent}`
    const endingFilePath = path.join(scriptDir, `./点赞关注${w_h}.mp4`); // TODO 随机片尾关注文件路径 

    let command2 = ''
    if (groupName == "coser本人") {
        // 打上水印
        command2 = `ffmpeg -ss ${beforeTime}   -i "${filePath}"  -r ${fps} -vf "${scale},drawtext=fontfile='./SourceHanSansCN-Bold.otf':text='coser：${nickName}':fontsize=16:fontcolor=white:x=50:y=50" -c:v libx264 -c:a aac "${videoTempPath}"`;
    } else {
        command2 = `ffmpeg -ss ${beforeTime}   -i "${filePath}"  -r ${fps} -vf "${scale}" -c:v libx264 -c:a aac "${videoTempPath}"`;
    }
    await runFFmpegCommand(command2);




    let scaleName = scale.split(':').join('x').split("=")[1]
    // N s合集处理
    const videoTrueDuration = (videoParams.duration - beforeTime);
    biliObj.totalDuration += videoTrueDuration
    biliObj.fileStr += `file '${videoTempPath}'\n`;
    if (biliObj.totalDuration > biliObj.mergedLimitTime) {
        const txtPath = path.join(newVideoFolderPath, `merged_video_${biliObj.videoIndex}_${biliObj.totalDuration}s_${scaleName}_filelist.txt`)
        const mp4File = path.join(newVideoFolderPath, `merged_video_${biliObj.videoIndex}_${biliObj.totalDuration}s_${scaleName}.mp4`)
        fsPromises.writeFile(txtPath, biliObj.fileStr);
        biliObj.totalDuration = 0
        biliObj.fileStr = ''
        biliObj.videoIndex += 1
        biliObj.needMergeBiliBiliVideoPath.push({
            txtPath,
            mp4File
        })
        biliObj.needDeleteTempFilePath.push(txtPath)
    }
    biliObj.needDeleteTempFilePath.push(videoTempPath)

    // 步骤3：生成 filelist.txt
    const filelistContentTest = `file '${videoTempPath}'\nfile '${endingFilePath}'`;
    fs.writeFileSync(fileListPath, filelistContentTest);


    const finalVideoPath = path.join(newVideoFolderPath, `${tempFileName}_${videoTrueDuration}s_${scaleName}${fileExt}`);
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

    // const originNewFilePath = path.join(
    //     newVideoFolderPath,
    //     `${originFileName}${fileExt}`
    // );
    // fs.renameSync(filePath, originNewFilePath); // 不移动原始文件
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


async function main() {
    try {
        const files = await fsPromises.readdir(videoFolderPath);
        const CGfile = path.join(gameFoldPath, '/CG/CG.mp4')
        const CGfile_16_9_path = path.join(gameFoldPath, '/CG_16_9.mp4')
        const CGfile_9_16_path = path.join(gameFoldPath, '/CG_9_16.mp4')
        if (fs.existsSync(CGfile)) {
            if (!fs.existsSync(CGfile_16_9_path)) {
                let command = `ffmpeg -i "${CGfile}"  -r 30 -vf "scale=1920:1080" -c:v libx264 -c:a aac "${CGfile_16_9_path}"`;
                await runFFmpegCommand(command)
            }
            if (!fs.existsSync(CGfile_9_16_path)) {
                let command = `ffmpeg -i "${CGfile}"  -r 30 -vf "scale=1080:1920" -c:v libx264 -c:a aac "${CGfile_9_16_path}"`;
                await runFFmpegCommand(command)
            }
        }



        const videoPromises = [];


        for (const file of files) {
            if (path.extname(file).toLowerCase() === ".mp4") {
                const filePath = path.join(videoFolderPath, file);
                const videoParams = await getVideoParams(filePath);
                try {
                    videoPromises.push(processVideo(filePath, videoParams, videoInfoObj, CGfile))
                } catch (error) {
                }
            }
        }

        const videoResults = await Promise.all(videoPromises)
        // 合并30s视频,合并音频
        await Promise.all(videoInfoObj.needMergeBiliBiliVideoPath.map(async ({ txtPath,
            mp4File, }) => {
            const command = `ffmpeg -f concat -safe 0 -i "${txtPath}" -i "${musicFilePath}" -c copy -map 0:v:0 -map 1:a:0 -shortest  "${mp4File}"`;
            return await runFFmpegCommand(command);
        }))
        // 删除临时文件
        await Promise.all(videoInfoObj.needDeleteTempFilePath.map(async (filePath) => {
            return await fsPromises.unlink(filePath);
        }))





        // // 处理合并逻辑
        // let videoQueue = [];
        // let totalDuration = 0;

        // for (const result of videoResults) {
        //     videoQueue.push(result);
        //     totalDuration += result.duration;

        //     if (totalDuration >= 30) {
        //         await mergeVideos(videoQueue);
        //         videoQueue = [];
        //         totalDuration = 0;
        //     }
        // }

        // 将文件名映射保存为 JSON 文件
        fs.writeFileSync(mapFilePath, JSON.stringify(fileNameMap, null, 2));
    } catch (err) {
        console.error("主程序执行出错: " + err);
        fs.writeFileSync(mapFilePath, JSON.stringify(fileNameMap, null, 2));
    }
}

main().catch((err) => {
    console.error("主程序执行出错: " + err);
});
