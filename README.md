# MIR Audio Analysis Tool
Analyze your music collection for mood, tempo, key, and danceability using deep learning models.

## Quick Start

### Requirements
- Node.js 16+
- Audio files (MP3, WAV, FLAC, OGG, M4A, AAC)

### Setup
```bash
git clone https://github.com/jasonmokk/mir-workflow.git
cd mir-workflow
npm install
npx playwright@1.52.0 install
```

Add your music to the `data` folder, then run:
```bash
npm start
```

That's it. The tool processes everything automatically and saves results to `results/music_analysis_results_01.csv`.

## What Gets Analyzed
- **Danceability** (0-100%)
- **Mood**: Happy, Sad, Relaxed, Aggressive (0-100% each)
- **BPM** (beats per minute)
- **Musical Key**

## Common Issues
- **"Node.js not found"** - Install from nodejs.org
- **"No audio files found"** - Put files in the data folder
- **"Browser launch failed"** - Run `npx playwright install`
- **Analysis hangs** - Try with fewer files first, remove corrupted files

## File Structure
```
mir-workflow/
├── data/           # Put your audio files here
├── results/        # Analysis results (CSV)
├── automation/     # Processing engine
└── run-analysis.js # Main script
```

## Processing Time
- **10-50 files**: ~10 minutes
- **100-200 files**: ~45 minutes
- **400+ files**: 2-3 hours

## Manual Mode
Start server only (for web interface):
```bash
npm run server
```

## Technical Implementation

### Architecture
- **Frontend**: Essentia.js web application with TensorFlow.js models
- **Backend**: Express.js server with Playwright automation
- **Processing**: Batch processing (50 files/batch) with memory management

### Models
- **MusiCNN**: Deep CNN for music feature extraction
- **Training Data**: Million Song Dataset (MSD-2)
- **Inference**: Real-time processing via WebAssembly + TensorFlow.js

### Analysis Pipeline
1. Audio feature extraction using Essentia algorithms
2. Model inference for mood/rhythm classification
3. Musical key detection via harmonic analysis
4. BPM extraction through beat tracking algorithms

### Output Format
CSV with columns: filename, danceability, happy, sad, relaxed, aggressive, bpm, key

Each analysis creates numbered result files (01, 02, 03...) - no data carryover between runs.

### Performance
- Memory-optimized batch processing
- Supports files up to 100MB
- Error recovery and logging in `automation/logs/`

## Citation
For academic use, cite:
```
Music Technology Group (MTG), Universitat Pompeu Fabra. Essentia.js: Real-time music analysis in the browser.
```

MIT License.
