# TranscriptVimeo
Extract transcripts from Vimeo

## Usage

This script extracts transcripts from Vimeo videos with transcript feature enabled.

### How to Use

1. Open a Vimeo video with transcripts (e.g., https://vimeo.com/982536311?&login=true#_=_)
2. Open the browser's Developer Console (F12)
3. Copy and paste the content of `extractVimeoTranscript.js` into the console
4. Press Enter to execute the script

### What it does

The script will:
- Automatically scroll through the virtual transcript container
- Collect all transcript text with timestamps
- Copy the complete transcript to your clipboard
- Download the transcript as a text file named `Houdini_Copernicus_Transcript.txt`
- Scroll back to the top of the transcript

### Output

The transcript will include timestamps in the format:
```
[00:00] First line of transcript

[00:05] Second line of transcript
```
