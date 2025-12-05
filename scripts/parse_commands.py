import json
import traceback
from openai import AsyncOpenAI
from pydantic import BaseModel
import asyncio
from tqdm import tqdm
import dotenv

dotenv.load_dotenv()

client = AsyncOpenAI(
    api_key=dotenv.get_key(dotenv.find_dotenv(), "DEESEEK_API_KEY"),
    base_url="https://api.deepseek.com",
)

SEMAPHORE = asyncio.Semaphore(30)
progress = tqdm()

system_prompt = """
用户将会提供一个命令的说明文档，请将其解析为结构化的数据，包含以下字段：
- signature: 命令的完整签名
- commandBase: 命令的基础部分
- description: 命令的简要描述
- examples: 命令的使用示例列表，每个示例包含description和command字段
- note: 任何额外的备注信息

EXAMPLE INPUT:'
copy [source] [destination] [options]
Copies files from source to destination.
--- Example ---
Description: Copy a file to a new location
Command: copy file.txt /new/location/file.txt
--- Example ---
Description: Copy a file with verbose output
Command: copy file.txt /new/location/file.txt --verbose
--- Note ---
Ensure you have the necessary permissions to copy files.
'

EXAMPLE JSON OUTPUT:
{
    "signature": "copy [source] [destination] [options]",
    "commandBase": "copy",
    "description": "Copies files from source to destination.",
    "examples": [
        {
        "description": "Copy a file to a new location",
        "command": "copy file.txt /new/location/file.txt"
        },
        {
        "description": "Copy a file with verbose output",
        "command": "copy file.txt /new/location/file.txt --verbose"
        }
    ],
    "note": "Ensure you have the necessary permissions to copy files."
}
"""

class Example(BaseModel):
    description: str = ""
    command: str = ""

class Command(BaseModel):
    signature: str = ""
    commandBase: str = ""
    description: str = ""
    examples: list[Example] = []
    note: str = ""

class CommandParser:
    @classmethod
    async def _parse_command(cls, command_string: str) -> Command:
        global client, system_prompt
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": command_string}
        ]
        async with SEMAPHORE:
            print("Parsing command...")
            response = await client.chat.completions.create(
                model="deepseek-chat",
                messages=messages,  # type: ignore
                response_format={
                    "type": "json_object",
                }  # type: ignore
            )
        return Command(**(json.loads(response.choices[0].message.content))) # type: ignore

    @classmethod
    async def parse_command(cls, result: list, command_string: str) -> Command:
        global progress
        for attempt in range(5):
            try:
                command = await cls._parse_command(command_string)
                result.append(command)
                progress.update(1)
                return command
            except Exception as e:
                print(f"Error parsing command, attempt {attempt + 1}: {e}")
                traceback.print_exc()
                if attempt == 4:
                    raise e
                await asyncio.sleep(2 ** attempt)
        raise RuntimeError("Failed to parse command after multiple attempts")

async def main():
    global progress
    with open("./docs/commands.json", "r") as file:
        commands = json.load(file)
    progress = tqdm(total=len(commands), desc="Parsing Commands")
    result: list[Command] = []

    async with asyncio.TaskGroup() as tg:
        for command in commands:
            tg.create_task(CommandParser.parse_command(result, command))
            await asyncio.sleep(0.1)  # Slight delay to avoid overwhelming the API
    progress.close()

    print("Writing parsed commands to file...")
    with open("./docs/parsed_commands.json", "w") as file:
        json.dump([command.model_dump() for command in result], file, indent=4, ensure_ascii=False)
    print("Done.")

if __name__ == "__main__":
    asyncio.run(main())