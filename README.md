# 🎵 MIR Audio Analysis Tool

> **Automated music information retrieval using Essentia.js and deep learning models**

Transform your entire music collection into detailed analytical data with a single command. This tool analyzes audio files for mood, danceability, tempo (BPM), musical key, and other important musical characteristics.

---

## 🚀 Start 

### Prerequisites
- **Node.js 16+** ([Download here](https://nodejs.org/))
- **Audio files** in common formats (MP3, WAV, FLAC, OGG, M4A, AAC)
- **Run the below command to ensure your macbook always uses the correct Node path:**
  ```
  echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.zshrc
  source ~/.zshrc
  ```


### Installation & Setup

1. **Clone or download this repository**
   ```bash
   git clone https://github.com/jasonmokk/mir-workflow.git
   cd mir-workflow
   ```
   **Or if already cloned, cd into the path and pull any recent changes**
   ```bash
   git pull
   ```

3. **Install dependencies**
   ```bash
   npm install
   npx playwright@1.52.0 install
   ```

4. **Add your audio files**
   - Copy your audio files into the existing `data` folder
   ```
   mir-workflow/
   ├── data/
   │   ├── song1.mp3
   │   ├── song2.wav
   │   └── more_music...
   └── run-analysis.js
   ```

5. **Run the analysis**
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
- Run `npx playwright install` or `npx playwright@1.52.0 install`

### ❌ Analysis stops or hangs
**Solution**:
- **Small files first**: Try with 5-10 files first to ensure everything works
- **File size**: Very large files (>100MB) are automatically skipped
- **Corrupted files**: Remove any corrupted audio files
- **Memory**: Close other applications if you're processing many files

### ❌ "Port already in use"
**Solution**: 
- The tool automatically finds available ports
- Close all terminal tabs and run the analysis again

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

You can check `automation/logs` for detailed log reports of each workflow run.

---

### Supported Audio Formats:
- **MP3** - Most common, fastest processing
- **WAV** - Uncompressed, high quality
- **FLAC** - Lossless compression
- **OGG** - Open source format
- **M4A** - Apple format
- **AAC** - Advanced audio codec



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

### Underlying Models and Analysis

This project uses Essentia.js, a powerful audio analysis library, combined with pre-trained deep learning models for music analysis. The system employs several specialized models:

#### Core Models
- **MusiCNN Architecture**: Based on the Musicnn deep learning model for music analysis
- **MSD-2 Dataset**: Models trained on the Million Song Dataset (MSD-2)

#### Analysis Features
1. **Mood Analysis**
   - Happy/Sad detection
   - Aggressive/Relaxed classification
   - Mood intensity scoring

2. **Rhythm Analysis**
   - BPM (Beats Per Minute) detection
   - Rhythm patterns
   - Danceability scoring

3. **Musical Features**
   - Key detection
   - Scale analysis
   - Musical structure

#### Technical Implementation
- Uses Essentia.js for audio processing and feature extraction
- Implements TensorFlow.js for model inference
- Processes audio in real-time using WebAssembly
- Supports batch processing of multiple files

#### Model Architecture
The system uses a combination of:
- **MusiCNN**: Deep convolutional neural network for music analysis
- **Essentia Algorithms**: For low-level audio feature extraction
- **TensorFlow.js**: For model inference in the browser

</details>

---

## 📜 License

MIT License - Feel free to use for academic and research purposes.

---
