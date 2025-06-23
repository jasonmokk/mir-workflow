<div align="center">

# 🎵 MIR Audio Analysis Tool

**Automated music information retrieval using deep learning models**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.52.0-blue.svg)](https://playwright.dev/)
[![TensorFlow.js](https://img.shields.io/badge/TensorFlow.js-3.5.0-orange.svg)](https://www.tensorflow.org/js)

Analyze your entire music collection for mood, tempo, key, and danceability with a single command.

[Features](#-features) • [Quick Start](#-quick-start) • [Usage](#-usage) • [Technical Details](#-technical-details)

</div>

---

## ✨ Features

- 🎯 **One-command analysis** - Process entire music libraries automatically  
- 🧠 **Deep learning models** - MusiCNN architecture trained on Million Song Dataset
- 📊 **Comprehensive metrics** - Mood, danceability, BPM, and musical key detection
- ⚡ **Batch processing** - Memory-optimized handling of large collections
- 📁 **Multiple formats** - MP3, WAV, FLAC, OGG, M4A, AAC support
- 🔄 **Error recovery** - Robust processing with detailed logging

## 🚀 Quick Start

### Prerequisites
```bash
Node.js 16+ • Audio files in common formats
```

### Installation
```bash
git clone https://github.com/jasonmokk/mir-workflow.git
cd mir-workflow
npm install
npx playwright@1.52.0 install
```

### Usage
```bash
# 1. Add your music files to the data/ folder
# 2. Run analysis
npm start
```

**Results saved to:** `results/music_analysis_results_01.csv`

## 📈 Analysis Output

| Feature | Description | Range |
|---------|-------------|-------|
| **Danceability** | How suitable for dancing | 0-100% |
| **Happy** | Happiness/joy level | 0-100% |
| **Sad** | Sadness intensity | 0-100% |
| **Relaxed** | Calmness/relaxation | 0-100% |
| **Aggressive** | Energy/aggression level | 0-100% |
| **BPM** | Beats per minute | Numeric |
| **Key** | Musical key signature | String |

## 📂 Project Structure

```
mir-workflow/
├── 📁 data/           # 🎵 Your audio files
├── 📁 results/        # 📊 Analysis results (CSV)
├── 📁 automation/     # ⚙️  Processing engine
├── 📁 models/         # 🤖 Deep learning models
└── 📄 run-analysis.js # 🚀 Main script
```

## ⚡ Performance

| Collection Size | Processing Time |
|----------------|-----------------|
| 10-50 files | ~10 minutes |
| 100-200 files | ~45 minutes |
| 400+ files | 2-3 hours |

> **💡 Tip:** MP3 files process fastest. Files over 100MB are automatically skipped.

## 🛠️ Advanced Usage

### Manual Mode
```bash
npm run server  # Web interface at http://localhost:3000
```

### Troubleshooting
| Issue | Solution |
|-------|----------|
| `Node.js not found` | Install from [nodejs.org](https://nodejs.org/) |
| `No audio files found` | Add files to `data/` folder |
| `Browser launch failed` | Run `npx playwright install` |
| `Analysis hangs` | Try fewer files, remove corrupted files |

## 🔬 Technical Details

<details>
<summary><strong>🏗️ Architecture</strong></summary>

### Stack
- **Frontend:** Essentia.js + TensorFlow.js
- **Backend:** Express.js + Playwright automation  
- **Processing:** WebAssembly + batch optimization
- **Models:** MusiCNN (Million Song Dataset)

### Pipeline
1. **Feature Extraction** → Essentia.js algorithms
2. **Model Inference** → CNN-based classification
3. **Key Detection** → Harmonic analysis  
4. **BPM Extraction** → Beat tracking
5. **CSV Export** → Structured data output

</details>

<details>
<summary><strong>🎯 Model Details</strong></summary>

### MusiCNN Models
- **Training Data:** Million Song Dataset (MSD-2)
- **Architecture:** Deep Convolutional Neural Network
- **Inference:** Real-time via WebAssembly
- **Features:** Multi-label mood and rhythm classification

### Supported Analysis
- Mood classification (4 dimensions)
- Rhythmic pattern analysis  
- Harmonic content analysis
- Temporal feature extraction

</details>

## 📊 Output Format

```csv
filename,danceability,happy,sad,relaxed,aggressive,bpm,key
song1.mp3,85.2,72.1,12.3,45.6,23.8,128,C major
song2.wav,67.4,34.2,67.8,78.9,8.1,95,A minor
```

Each analysis creates numbered result files with no data carryover between runs.

## 📜 Citation

For academic use:
```bibtex
@software{essentia_js,
  title={Essentia.js: Real-time music analysis in the browser},
  author={Music Technology Group (MTG)},
  organization={Universitat Pompeu Fabra},
  url={https://essentia.upf.edu/}
}
```

## 🤝 Contributing

Contributions welcome! Please read our [contributing guidelines](CONTRIBUTING.md) first.

## 📄 License

[MIT License](LICENSE) - Free for academic and commercial use.

---

<div align="center">

**Made with ❤️ for music researchers and enthusiasts**

⭐ **Star this repo if it helped you!** ⭐

</div>
