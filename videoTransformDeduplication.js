const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const fsPromises = fs.promises;
const execPromise = util.promisify(exec);


// 获取视频的宽度和高度
async function getVideoDimensions(filePath) {
    const command = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    try {
        const { stdout, stderr } = await execPromise(command);
        if (stderr) {
            console.error(`FFmpeg标准错误输出: ${stderr}`);
        }
        const [width, height] = stdout.trim().split('\n');
        return { width: parseInt(width, 10), height: parseInt(height, 10) };
    } catch (error) {
        console.error(`获取视频尺寸时出错: ${error.message}`);
        throw error;
    }
}

// 修改分辨率和帧数
async function modifyResolutionAndFrameRate(inputFilePath, outputFilePath, scalePercent, targetWidth, targetHeight, frameRate) {
    const { width: originalWidth, height: originalHeight } = await getVideoDimensions(inputFilePath);

    const newWidth = Math.round(originalWidth * scalePercent);
    const newHeight = Math.round(originalHeight * scalePercent);

    const command = `ffmpeg -i "${inputFilePath}" -vf "scale=${newWidth}:${newHeight},fps=${frameRate}" "${outputFilePath}"`;
    try {
        await execPromise(command);
        console.log(`分辨率和帧数修改完成: ${outputFilePath}`);
    } catch (error) {
        console.error(`修改分辨率和帧数时出错: ${error.message}`);
        throw error;
    }
}

// 添加模糊效果
async function addBlurEffect(inputFilePath, outputFilePath, blurRadius) {
    const command = `ffmpeg -i "${inputFilePath}" -vf "boxblur=${blurRadius}" "${outputFilePath}"`;
    try {
        await execPromise(command);
        console.log(`模糊效果添加完成: ${outputFilePath}`);
    } catch (error) {
        console.error(`添加模糊效果时出错: ${error.message}`);
        throw error;
    }
}

// 进行色彩微调
async function adjustColor(inputFilePath, outputFilePath, brightness, contrast, saturation) {
    const command = `ffmpeg -i "${inputFilePath}" -vf "eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}" "${outputFilePath}"`;
    try {
        await execPromise(command);
        console.log(`色彩微调完成: ${outputFilePath}`);
    } catch (error) {
        console.error(`色彩微调时出错: ${error.message}`);
        throw error;
    }
}

// 添加变速效果
async function changeVideoSpeed(inputFilePath, outputFilePath, speedFactor) {
    // speedFactor > 1 加速, < 1 减速, 例如 0.8 为减速到 80%, 1.2 为加速到 120%
    const command = `ffmpeg -i "${inputFilePath}" -filter:v "setpts=${1 / speedFactor}*PTS" -filter:a "atempo=${speedFactor}" "${outputFilePath}"`;
    try {
        await execPromise(command);
        console.log(`视频变速完成: ${outputFilePath}`);
    } catch (error) {
        console.error(`视频变速时出错: ${error.message}`);
        throw error;
    }
}

// 添加镜像效果
async function mirrorVideo(inputFilePath, outputFilePath) {
    const command = `ffmpeg -i "${inputFilePath}" -vf "hflip" -c:a copy "${outputFilePath}"`;
    try {
        await execPromise(command);
        console.log(`视频镜像完成: ${outputFilePath}`);
    } catch (error) {
        console.error(`视频镜像时出错: ${error.message}`);
        throw error;
    }
}

// 添加淡入淡出效果
async function addFadeEffect(inputFilePath, outputFilePath, duration) {
    const command = `ffmpeg -i "${inputFilePath}" -vf "fade=t=in:st=0:d=${duration},fade=t=out:st=end_duration-${duration}:d=${duration}" "${outputFilePath}"`;
    try {
        await execPromise(command);
        console.log(`淡入淡出效果添加完成: ${outputFilePath}`);
    } catch (error) {
        console.error(`添加淡入淡出效果时出错: ${error.message}`);
        throw error;
    }
}

// 添加视频旋转
async function rotateVideo(inputFilePath, outputFilePath, angle) {
    const command = `ffmpeg -i "${inputFilePath}" -vf "rotate=${angle}*PI/180" "${outputFilePath}"`;
    try {
        await execPromise(command);
        console.log(`视频旋转完成: ${outputFilePath}`);
    } catch (error) {
        console.error(`视频旋转时出错: ${error.message}`);
        throw error;
    }
}

// 添加背景虚化
async function addBlurredBackground(inputFilePath, outputFilePath, topPercent = 0.1, bottomPercent = 0.1) {
    const command = `ffmpeg -i "${inputFilePath}" -filter_complex "[0:v]split=2[bg][fg];[bg]scale=iw*1.1:-1,boxblur=20:20[blurred];[blurred][fg]overlay=(W-w)/2:(H-h)/2" "${outputFilePath}"`;
    try {
        await execPromise(command);
        console.log(`背景虚化完成: ${outputFilePath}`);
    } catch (error) {
        console.error(`添加背景虚化时出错: ${error.message}`);
        throw error;
    }
}

// 删除中间文件
async function deleteIntermediateFiles(foldPath, baseFileName) {
    const intermediateFiles = [
        `${baseFileName}_modified.mp4`,
        `${baseFileName}_speed_adjusted.mp4`,
        `${baseFileName}_mirrored.mp4`,
        `${baseFileName}_rotated.mp4`,
        `${baseFileName}_blurred_bg.mp4`,
        `${baseFileName}_blurred.mp4`,
        `${baseFileName}_color_adjusted.mp4`,
        `${baseFileName}_fade.mp4`
    ];

    for (const fileName of intermediateFiles) {
        const filePath = path.join(foldPath, fileName);
        if (fs.existsSync(filePath)) {
            await fsPromises.unlink(filePath);
            console.log(`删除中间文件: ${filePath}`);
        }
    }
}

// 添加去重配置接口
async function deduplicateVideo(filePath, deduplicationConfig = {
    // 基础参数
    speedFactor: 0.95,      // 变速因子(0.8-1.2)
    // 注释掉基础转换相关参数，因为已经在 videoReName_FFmpegHandle.js 处理过
    // targetWidth: 1280,      // 目标宽度
    // targetHeight: 720,      // 目标高度
    // frameRate: 30,          // 目标帧率
    // scalePercent: 0.8,      // 缩放比例(0-1)

    // 特效参数
    enableMirror: false,    // 是否启用镜像
    enableRotate: false,    // 是否启用旋转
    rotateAngle: 1,         // 旋转角度(0-360)
    enableBlur: false,      // 是否启用模糊
    blurRadius: 0.1,        // 模糊半径(0-1)
    enableFade: false,      // 是否启用淡入淡出
    fadeDuration: 0.5,      // 淡入淡出时长(秒)

    // 色彩参数 - 设置默认值
    brightness: 0,          // 亮度调整(-1到1)
    contrast: 1,            // 对比度调整(0-2) 
    saturation: 1,          // 饱和度调整(0-2)

    // 背景参数
    enableBgBlur: false,    // 是否启用背景虚化
    bgBlurTop: 0.1,         // 上部虚化比例(0-1)
    bgBlurBottom: 0.1,      // 下部虚化比例(0-1)
}) {
    console.log(deduplicationConfig)
    const foldPath = path.dirname(filePath);
    const baseFileName = path.basename(filePath, path.extname(filePath));
    const originFilePath = filePath;

    // 根据配置参数决定处理流程
    let currentFilePath = originFilePath;

    // 注释掉基础转换部分
    // // 1. 基础处理 - 分辨率和帧率(必选)
    // let modifiedFilePath = path.join(foldPath, `${baseFileName}_modified.mp4`);
    // await modifyResolutionAndFrameRate(
    //   currentFilePath, 
    //   modifiedFilePath,
    //   deduplicationConfig.scalePercent,
    //   deduplicationConfig.targetWidth,
    //   deduplicationConfig.targetHeight, 
    //   deduplicationConfig.frameRate
    // );
    // currentFilePath = modifiedFilePath;

    // 1. 变速处理(可选)
    if (deduplicationConfig.speedFactor !== 1) {
        let speedAdjustedFilePath = path.join(foldPath, `${baseFileName}_speed_adjusted.mp4`);
        await changeVideoSpeed(
            currentFilePath,
            speedAdjustedFilePath,
            deduplicationConfig.speedFactor
        );
        currentFilePath = speedAdjustedFilePath;
    }

    // 4. 背景虚化(可选)
    if (deduplicationConfig.enableBgBlur) {
        let blurredBgFilePath = path.join(foldPath, `${baseFileName}_blurred_bg.mp4`);
        await addBlurredBackground(
            currentFilePath,
            blurredBgFilePath,
            deduplicationConfig.bgBlurTop,
            deduplicationConfig.bgBlurBottom
        );
        currentFilePath = blurredBgFilePath;
    }

    // 5. 模糊效果(可选)
    if (deduplicationConfig.enableBlur) {
        let blurredFilePath = path.join(foldPath, `${baseFileName}_blurred.mp4`);
        await addBlurEffect(
            currentFilePath,
            blurredFilePath,
            deduplicationConfig.blurRadius
        );
        currentFilePath = blurredFilePath;
    }

    // 6. 色彩调整(仅当参数不是默认值时才处理) 可选
    if (deduplicationConfig.brightness !== 0 ||
        deduplicationConfig.contrast !== 1 ||
        deduplicationConfig.saturation !== 1) {
        let colorAdjustedFilePath = path.join(foldPath, `${baseFileName}_color_adjusted.mp4`);
        await adjustColor(
            currentFilePath,
            colorAdjustedFilePath,
            deduplicationConfig.brightness,
            deduplicationConfig.contrast,
            deduplicationConfig.saturation
        );
        currentFilePath = colorAdjustedFilePath;
    }

    // 7. 淡入淡出(可选)
    if (deduplicationConfig.enableFade) {
        let fadeFilePath = path.join(foldPath, `${baseFileName}_fade.mp4`);
        await addFadeEffect(
            currentFilePath,
            fadeFilePath,
            deduplicationConfig.fadeDuration
        );
        currentFilePath = fadeFilePath;
    }

    // 2. 镜像处理(可选)
    if (deduplicationConfig.enableMirror) {
        let mirroredFilePath = path.join(foldPath, `${baseFileName}_mirrored.mp4`);
        await mirrorVideo(currentFilePath, mirroredFilePath);
        currentFilePath = mirroredFilePath;
    }

    // 3. 旋转处理(可选)
    if (deduplicationConfig.enableRotate) {
        let rotatedFilePath = path.join(foldPath, `${baseFileName}_rotated.mp4`);
        await rotateVideo(
            currentFilePath,
            rotatedFilePath,
            deduplicationConfig.rotateAngle
        );
        currentFilePath = rotatedFilePath;
    }

    // 重命名最终文件
    await fsPromises.rename(currentFilePath, filePath);
    console.log(`最终处理后的文件: ${filePath}`);

    // 删除中间文件
    await deleteIntermediateFiles(foldPath, baseFileName);
}

// 导出模块
module.exports = {
    deduplicateVideo,
    // 更新默认配置
    defaultDeduplicationConfig: {
        speedFactor: 0.95,
        enableMirror: false,
        enableRotate: false,
        rotateAngle: 1,
        enableBlur: false,
        blurRadius: 0.1,
        enableFade: false,
        fadeDuration: 0.5,
        brightness: 0,        // 更新默认值
        contrast: 1,          // 更新默认值
        saturation: 1,        // 更新默认值
        enableBgBlur: false,
        bgBlurTop: 0.1,
        bgBlurBottom: 0.1
    }
};