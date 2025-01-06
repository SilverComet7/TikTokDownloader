const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');

const fsPromises = fs.promises;
const execPromise = util.promisify(exec);

// 获取当前脚本所在的目录
const scriptDir = path.dirname(__filename);



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
async function modifyResolutionAndFrameRate(inputFilePath, outputFilePath, targetWidth, targetHeight, frameRate) {
    const { width: originalWidth, height: originalHeight } = await getVideoDimensions(inputFilePath);
    // const { width: newWidth, height: newHeight } = calculateScaledResolution(originalWidth, originalHeight, targetWidth, targetHeight);
    const percent = 0.8
    const newWidth = Math.round(originalWidth * percent);
    const newHeight = Math.round(originalHeight * percent);

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

// 删除中间文件
async function deleteIntermediateFiles(foldPath, baseFileName) {
    const intermediateFiles = [
        `${baseFileName}_modified.mp4`,
        `${baseFileName}_blurred.mp4`,
        `${baseFileName}_color_adjusted.mp4`
    ];

    for (const fileName of intermediateFiles) {
        const filePath = path.join(foldPath, fileName);
        if (fs.existsSync(filePath)) {
            await fsPromises.unlink(filePath);
            console.log(`删除中间文件: ${filePath}`);
        }
    }
}

// 处理单个视频文件
async function processVideo(filePath) {
    const foldPath = path.dirname(filePath);
    const baseFileName = path.basename(filePath, path.extname(filePath)).split("_")[0];
    console.log("🚀 ~ processVideo ~ foldPath:", foldPath);
    console.log("🚀 ~ processVideo ~ baseFileName:", baseFileName);

    const originalFilePath = filePath;
    const originFilePath = path.join(foldPath, `${baseFileName}_origin.mp4`);

    // 重命名原始文件为 _origin
    await fsPromises.rename(originalFilePath, originFilePath);
    console.log(`原始文件重命名为: ${originFilePath}`);

    const inputFilePath = originFilePath;
    const outputFilePath = path.join(foldPath, `${baseFileName}.mp4`);
    const targetWidth = 1280; // 目标宽度
    const targetHeight = 720; // 目标高度
    const frameRate = 30;
    const blurRadius = 0.1; // 模糊模糊半径
    const brightness = 0.1; // 调整亮度
    const contrast = 1.2;   // 调整对比度
    const saturation = 1.1; // 调整饱和度

    // 修改分辨率和帧数
    let modifiedFilePath = path.join(foldPath, `${baseFileName}_modified.mp4`);
    await modifyResolutionAndFrameRate(inputFilePath, modifiedFilePath, targetWidth, targetHeight, frameRate);

    // 添加模糊效果
    let blurredFilePath = path.join(foldPath, `${baseFileName}_blurred.mp4`);
    await addBlurEffect(modifiedFilePath, blurredFilePath, blurRadius);

    // 进行色彩微调
    let colorAdjustedFilePath = path.join(foldPath, `${baseFileName}_color_adjusted.mp4`);
    await adjustColor(blurredFilePath, colorAdjustedFilePath, brightness, contrast, saturation);

    // 重命名最终处理后的文件为原始文件名
    await fsPromises.rename(colorAdjustedFilePath, outputFilePath);
    console.log(`最终处理后的文件: ${outputFilePath}`);

    // 删除中间文件
    await deleteIntermediateFiles(foldPath, baseFileName);
}

// 遍历指定文件夹下的 MP4 文件
async function processFolder(folderPath) {
    try {
        const files = await fsPromises.readdir(folderPath);
        for (const file of files) {
            console.log("🚀 ~ processFolder ~ file:", file);
            const filePath = path.join(folderPath, file);
            if (path.extname(file).toLowerCase() === '.mp4') {
                await processVideo(filePath);
            }
        }
    } catch (err) {
        console.error('无法扫描目录: ' + err);
    }
}

// 示例使用
async function main() {
    const foldPath = path.join(scriptDir, 'UID1934733553438055_𝐒𝐲𝐢𝐧𝐆𝐳𝟏_发布作品/');
    await processFolder(foldPath);
}

main().catch(err => {
    console.error('主程序执行出错: ' + err);
});