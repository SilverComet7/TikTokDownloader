from asyncio import CancelledError
from asyncio import run

from src.application import TikTokDownloader
import sys
import io
# 设置标准输出编码为 UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

async def main():
    async with TikTokDownloader() as downloader:
        try:
            await downloader.run()
        except (
                KeyboardInterrupt,
                CancelledError,
        ):
            return


if __name__ == "__main__":
    run(main())
