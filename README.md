# 🎵 MIR Audio Analysis Tool

> **Automated music information retrieval using Essentia.js and deep learning models**

Transform your entire music collection into detailed analytical data with a single command. This tool analyzes audio files for mood, danceability, tempo (BPM), musical key, and other important musical characteristics.

---

## 🚀 Start 

### Prerequisites
- **Node.js 16+** ([Download here](https://nodejs.org/))
- **Audio files** in common formats (MP3, WAV, FLAC, OGG, M4A, AAC)

### Installation & Setup

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/jasonmokk/mir-workflow.git
   cd mir-workflow
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add your audio files**
   - Copy your audio files into the existing `data` folder
   ```
   mir-workflow/
   ├── data/
   │   ├── song1.mp3
   │   ├── song2.wav
   │   └── more_music...
   └── run-analysis.js
   ```

4. **Run the analysis**
   ```bash
   npm start
   ```

**That's it!** 🎉 The tool will automatically:
- ✅ Start the analysis server
- ✅ Process all your audio files  
- ✅ Generate detailed CSV results
- ✅ Clean up everything when done

---

## 📊 What You'll Get

### Analysis Results Include:
- **🕺 Danceability** - How suitable for dancing (0-100%)
- **😊 Happy** - Happiness/joy level (0-100%)
- **😢 Sad** - Sadness level (0-100%)  
- **😌 Relaxed** - Relaxation/calmness (0-100%)
- **👊 Aggressive** - Energy/aggression level (0-100%)
- **🎵 BPM** - Beats per minute (tempo)
- **🎼 Musical Key** - Detected key signature

### Output Files:
- **Individual batches**: `automation/csv_exports/batch_csvs/`
- **Final results**: `results/music_analysis_results_01.csv`

The final CSV file is saved in the `results` directory with numbered filenames (01, 02, 03, etc.) and can be opened in Excel, Google Sheets, or any data analysis tool.

---

## 💡 Usage Examples

### Analyze Your Music Library
```bash
npm start
```

### Start Website Only (for manual analysis)
```bash
npm run server
```

### Get Help
```bash
npm run help
```

---

## 🛠️ Troubleshooting

### ❌ "Node.js not found" or "npm not found"
**Solution**: Install Node.js 16 or newer from [nodejs.org](https://nodejs.org/)

### ❌ "No audio files found"
**Solution**: 
- Add audio files to the `data` folder (it already exists in the project)
- Use supported formats: `.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a`, `.aac`
- Check that files aren't corrupted

### ❌ "Browser launch failed"
**Solution**: 
- The tool uses Playwright chromium
- Run `npx playwright install` or `npx playwright@1.52.0`

### ❌ Analysis stops or hangs
**Solution**:
- **Small files first**: Try with 5-10 files first to ensure everything works
- **File size**: Very large files (>100MB) are automatically skipped
- **Corrupted files**: Remove any corrupted audio files
- **Memory**: Close other applications if you're processing many files

### ❌ "Port already in use"
**Solution**: 
- The tool automatically finds available ports
- If issues persist, restart your computer

### ❌ Permission errors
**Solution**:
- **macOS/Linux**: Run `chmod +x run-analysis.js`
- **Windows**: Run as Administrator if needed

---

## 📁 Project Structure

```
mir-workflow/
├── 📁 data/                     # Your audio files go here
├── 📁 results/                  # Final analysis results (CSV files)
├── 📁 automation/               # Analysis engine (don't modify)
│   ├── 📁 csv_exports/         # Intermediate batch files
│   └── 📁 logs/                # Error logs (for troubleshooting)
├── 📄 run-analysis.js          # One-click analysis script
├── 📄 package.json             # Project configuration
└── 📄 README.md                # This file
```

---

## ⚡ Performance Tips

- **File organization**: Keep audio files organized in the `data` folder
- **Batch size**: The tool processes 50 files at a time for optimal speed
- **File formats**: MP3 files generally process fastest
- **File names**: Avoid special characters in filenames for best results

### Estimated Processing Times:
- **Small collection** (10-50 files): 5-15 minutes
- **Medium collection** (100-200 files): 30-60 minutes  
- **Large collection** (400+ files): 2-4 hours

---

## 🔧 Advanced Usage

### Manual Batch Processing
If you need more control over the process:

```bash
cd automation
node batch-processor.js upload ../data --batch-size 25
```

### Server-Only Mode
To use the web interface manually:

```bash
npm run server
# Open http://localhost:3000 in your browser
```

### Clean Run Every Time
Each analysis run creates a completely separate result file - no carryover from previous runs. Perfect for analyzing different music collections independently.

---

## 📋 System Requirements

### Minimum Requirements:
- **OS**: Windows 10, macOS 10.15, or Linux Ubuntu 18.04+
- **RAM**: 4GB (8GB recommended for large collections)
- **Storage**: 3GB free space (for browsers and processing)
- **Internet**: Required for initial setup only

### Supported Audio Formats:
- **MP3** - Most common, fastest processing
- **WAV** - Uncompressed, high quality
- **FLAC** - Lossless compression
- **OGG** - Open source format
- **M4A** - Apple format
- **AAC** - Advanced audio codec

---

## 🤝 Getting Help

### If You're Stuck:
1. **Check the logs**: Look in `automation/logs/` for detailed error messages
2. **Try fewer files**: Start with 5-10 files to test the system
3. **Check requirements**: Ensure Node.js 16+ is installed
4. **File formats**: Verify your audio files are in supported formats
5. **Restart**: Sometimes a simple restart resolves issues

### Error Logs Location:
- **Processing logs**: `automation/logs/`
- **Browser logs**: Printed to the console during analysis

---

## 🎯 Academic Research Use

This tool is designed for academic research and analysis. The generated CSV data can be used for:

- **Music recommendation systems**
- **Audio similarity analysis**  
- **Mood-based playlist generation**
- **Music therapy research**
- **Audio content analysis**
- **Machine learning dataset creation**

### Citation:
If you use this tool in academic work, please cite the underlying Essentia.js library:
```
Music Technology Group (MTG), Universitat Pompeu Fabra. Essentia.js: Real-time music analysis in the browser.
```

---

## 🔬 Technical Details

<details>
<summary>For Advanced Users (Click to Expand)</summary>

### Architecture:
- **Frontend**: Essentia.js web application with deep learning models
- **Backend**: Express.js server for file serving
- **Automation**: Playwright browser automation
- **Processing**: Batch processing with memory management
- **Output**: CSV export with data validation

### Models Used:
- **Mood classification**: CNN-based deep learning models
- **Danceability**: Temporal feature analysis
- **BPM detection**: Beat tracking algorithms
- **Key detection**: Harmonic analysis

### Performance Optimizations:
- Parallel processing where possible
- Memory cleanup between batches
- Optimized batch sizes for throughput
- Browser automation with error recovery

</details>

---

## 📜 License

MIT License - Feel free to use for academic and research purposes.

---

**🎵 Happy analyzing! Transform your music collection into data today! 🎵**
