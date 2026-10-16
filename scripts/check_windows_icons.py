"""Compare actual Explorer icon resources with the source ICO, not just config."""

import argparse
import glob
import json
from pathlib import Path
import struct


def ico_frames(path):
    data = path.read_bytes()
    reserved, kind, count = struct.unpack_from("<HHH", data)
    if reserved or kind != 1 or not count:
        raise ValueError("Expected a nonempty Windows ICO")
    frames = {}
    for index in range(count):
        width, height, _, _, _, _, size, offset = struct.unpack_from(
            "<BBBBHHII", data, 6 + index * 16
        )
        frames[(width or 256, height or 256)] = data[offset : offset + size]
    return frames


def verify_icon(binary, expected):
    import pefile

    with pefile.PE(str(binary), fast_load=True) as image:
        image.parse_data_directories(
            directories=[pefile.DIRECTORY_ENTRY["IMAGE_DIRECTORY_ENTRY_RESOURCE"]]
        )
        resources = {
            entry.id: entry for entry in image.DIRECTORY_ENTRY_RESOURCE.entries
        }
        icons = {}
        for entry in resources[3].directory.entries:
            leaf = entry.directory.entries[0].data.struct
            icons[entry.id] = image.get_data(leaf.OffsetToData, leaf.Size)
        # Explorer uses the first group when the executable has multiple icons.
        group = resources[14].directory.entries[0].directory.entries[0].data.struct
        data = image.get_data(group.OffsetToData, group.Size)
        count = struct.unpack_from("<H", data, 4)[0]
        frames = {}
        for index in range(count):
            width, height, _, _, _, _, _, icon_id = struct.unpack_from(
                "<BBBBHHIH", data, 6 + index * 14
            )
            frames[(width or 256, height or 256)] = icons[icon_id]
        for size in ((16, 16), (32, 32)):
            if frames.get(size) != expected.get(size) or size not in expected:
                raise AssertionError(
                    f"{binary.name}: Explorer's {size[0]}px icon is not the DeChord icon"
                )
    print(json.dumps({"binary": str(binary), "dechord_icon": "verified at 16px/32px"}))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("icon", type=Path)
    parser.add_argument("binaries", nargs="+")
    args = parser.parse_args()
    expected = ico_frames(args.icon)
    for pattern in args.binaries:
        matches = glob.glob(pattern)
        if not matches:
            raise FileNotFoundError(pattern)
        for binary in matches:
            verify_icon(Path(binary), expected)


if __name__ == "__main__":
    main()
