def chord_index_at_position(chords, position_ms, current_index=0):
    current_time = position_ms / 1000.0
    index = max(0, min(current_index, len(chords)))

    if index > 0 and index < len(chords) and chords[index][1] > current_time:
        index = 0

    while index < len(chords) and chords[index][1] <= current_time:
        index += 1

    return index
