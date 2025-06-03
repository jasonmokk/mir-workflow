import { AnalysisResults, toggleUploadDisplayHTML, PlaybackControls } from './viz.js';
import { preprocess, shortenAudio } from './audioUtils.js';
import { generateCSV, downloadCSV, exportCSV, CSV_SCHEMA } from './csvExport.js';
import './csvExportTest.js';

const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const KEEP_PERCENTAGE = 0.15; // keep only 15% of audio file

let essentia = null;
let essentiaAnalysis;
let featureExtractionWorker = null;
let inferenceWorkers = {};
const modelNames = ['mood_happy' , 'mood_sad', 'mood_relaxed', 'mood_aggressive', 'danceability'];
let inferenceResultPromises = [];

const resultsViz = new AnalysisResults(modelNames);
let wavesurfer;
let controls;

const dropInput = document.createElement('input');
dropInput.setAttribute('type', 'file');
dropInput.setAttribute('multiple', '');
dropInput.addEventListener('change', () => {
    processFileUpload(dropInput.files);
})

const dropArea = document.querySelector('#file-drop-area');
dropArea.addEventListener('dragover', (e) => { e.preventDefault() });
dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    processFileUpload(files);
})
dropArea.addEventListener('click', () => {
    dropInput.click();
})

// Add queue variables for batch processing
let filesQueue = [];
let isProcessing = false;

let analysedTracks = [];
let currentAnalysingFile = null;

// CSV Download UI management
let csvDownloadBtn = null;
let csvExportFeedback = null;

/**
 * Generates timestamp-based filename for CSV export
 * @returns {string} Filename with timestamp
 */
function generateCSVFilename() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `music_analysis_${year}-${month}-${day}_${hours}${minutes}${seconds}.csv`;
}

/**
 * Updates CSV download button state based on available tracks
 */
function updateCSVButtonState() {
    if (!csvDownloadBtn) return;
    
    const hasData = analysedTracks.length > 0;
    
    if (hasData) {
        csvDownloadBtn.classList.remove('disabled');
        csvDownloadBtn.title = `Download CSV with ${analysedTracks.length} track(s)`;
    } else {
        csvDownloadBtn.classList.add('disabled');
        csvDownloadBtn.title = 'No analysis results available';
    }
}

/**
 * Shows feedback message for CSV export
 * @param {string} type - Message type: 'success', 'error', 'info'
 * @param {string} message - Message text
 * @param {number} duration - Duration to show message (ms), 0 for permanent
 */
function showCSVFeedback(type, message, duration = 3000) {
    if (!csvExportFeedback) return;
    
    // Clear existing classes and set new type
    csvExportFeedback.className = `ui message ${type}`;
    
    // Set icon based on type
    const iconElement = csvExportFeedback.querySelector('.icon');
    const textElement = csvExportFeedback.querySelector('.message-text');
    
    switch (type) {
        case 'success':
            iconElement.className = 'checkmark icon';
            break;
        case 'error':
            iconElement.className = 'exclamation triangle icon';
            break;
        case 'info':
            iconElement.className = 'info circle icon';
            break;
        default:
            iconElement.className = 'icon';
    }
    
    textElement.textContent = message;
    csvExportFeedback.style.display = 'block';
    
    // Auto-hide after duration (if specified)
    if (duration > 0) {
        setTimeout(() => {
            csvExportFeedback.style.display = 'none';
        }, duration);
    }
}

/**
 * Handles CSV export button click
 */
function handleCSVExport() {
    if (analysedTracks.length === 0) {
        showCSVFeedback('error', 'No tracks available for export', 3000);
        return;
    }
    
    // Show loading state
    csvDownloadBtn.classList.add('loading');
    csvDownloadBtn.innerHTML = '<i class="spinner loading icon"></i>Generating CSV...';
    csvDownloadBtn.disabled = true;
    
    showCSVFeedback('info', `Exporting ${analysedTracks.length} track(s)...`, 0);
    
    try {
        // Generate filename with timestamp
        const filename = generateCSVFilename();
        
        // Use the existing CSV export functionality
        const result = exportCSV(analysedTracks, filename);
        
        // Reset button state
        csvDownloadBtn.classList.remove('loading');
        csvDownloadBtn.innerHTML = '<i class="download icon"></i>Download CSV';
        csvDownloadBtn.disabled = false;
        
        if (result.success) {
            showCSVFeedback('success', 
                `CSV exported successfully! (${result.statistics.processedTracks} tracks)`, 
                4000);
        } else {
            showCSVFeedback('error', 
                `Export failed: ${result.error || 'Unknown error'}`, 
                5000);
        }
    } catch (error) {
        console.error('CSV export error:', error);
        
        // Reset button state
        csvDownloadBtn.classList.remove('loading');
        csvDownloadBtn.innerHTML = '<i class="download icon"></i>Download CSV';
        csvDownloadBtn.disabled = false;
        
        showCSVFeedback('error', `Export failed: ${error.message}`, 5000);
    }
}

/**
 * Initializes CSV download UI functionality
 */
function initializeCSVDownloadUI() {
    csvDownloadBtn = document.getElementById('csv-download-btn');
    csvExportFeedback = document.getElementById('csv-export-feedback');
    
    if (csvDownloadBtn) {
        csvDownloadBtn.addEventListener('click', handleCSVExport);
        updateCSVButtonState(); // Initial state
    }
}

function processFileUpload(files) {
    if (!files || !files.length) return;

    // push incoming files into queue
    for (let i = 0; i < files.length; i++) {
        filesQueue.push(files[i]);
    }

    // start processing if idle
    if (!isProcessing) {
        processNextFile();
    }

    // reset the input so same file set can be selected again
    dropInput.value = "";
}

function processNextFile() {
    if (!filesQueue.length) {
        isProcessing = false;
        return;
    }

    isProcessing = true;
    const file = filesQueue.shift();
    currentAnalysingFile = file;

    // Prepare / reuse wavesurfer UI
    if (!wavesurfer) {
        wavesurfer = toggleUploadDisplayHTML('display');
        controls = new PlaybackControls(wavesurfer);
    }

    wavesurfer.loadBlob(file);
    if (controls) controls.toggleEnabled(false);

    // Decode and analyse
    file.arrayBuffer().then((ab) => {
        decodeFile(ab);
    });
}

function queueNextFile() {
    // Called after finishing analysis of current file
    if (filesQueue.length) {
        // slight delay to let UI breathe
        setTimeout(() => {
            processNextFile();
        }, 100);
    } else {
        isProcessing = false;
    }
}

function decodeFile(arrayBuffer) {
    audioCtx.resume().then(() => {
        audioCtx.decodeAudioData(arrayBuffer).then(async function handleDecodedAudio(audioBuffer) {
            console.info("Done decoding audio!");
            
            toggleLoader();
            
            const prepocessedAudio = preprocess(audioBuffer);
            await audioCtx.suspend();

            if (essentia) {
                essentiaAnalysis = computeKeyBPM(prepocessedAudio);
            }

            // reduce amount of audio to analyse
            let audioData = shortenAudio(prepocessedAudio, KEEP_PERCENTAGE, true); // <-- TRIMMED start/end

            // send for feature extraction
            createFeatureExtractionWorker();

            featureExtractionWorker.postMessage({
                audio: audioData.buffer
            }, [audioData.buffer]);
            audioData = null;
        })
    })
}

function computeKeyBPM (audioSignal) {
    let vectorSignal = essentia.arrayToVector(audioSignal);
    const keyData = essentia.KeyExtractor(vectorSignal, true, 4096, 4096, 12, 3500, 60, 25, 0.2, 'bgate', 16000, 0.0001, 440, 'cosine', 'hann');
    const bpm = essentia.PercivalBpmEstimator(vectorSignal, 1024, 2048, 128, 128, 210, 50, 16000).bpm;
    
    // const bpm = essentia.RhythmExtractor(vectorSignal, 1024, 1024, 256, 0.1, 208, 40, 1024, 16000, [], 0.24, true, true).bpm;
    // const bpm = essentia.RhythmExtractor2013(vectorSignal, 208, 'multifeature', 40).bpm;

    return {
        keyData: keyData,
        bpm: bpm
    };
}

function createFeatureExtractionWorker() {
    featureExtractionWorker = new Worker('./src/featureExtraction.js');
    featureExtractionWorker.onmessage = function listenToFeatureExtractionWorker(msg) {
        // feed to models
        if (msg.data.features) {
            modelNames.forEach((n) => {
                // send features off to each of the models
                inferenceWorkers[n].postMessage({
                    features: msg.data.features
                });
            });
            msg.data.features = null;
        }
        // free worker resource until next audio is uploaded
        featureExtractionWorker.terminate();
    };
}

function createInferenceWorkers() {
    modelNames.forEach((n) => { 
        inferenceWorkers[n] = new Worker('./src/inference.js');
        inferenceWorkers[n].postMessage({
            name: n
        });
        inferenceWorkers[n].onmessage = function listenToWorker(msg) {
            // listen out for model output
            if (msg.data.predictions) {
                const preds = msg.data.predictions;
                // emmit event to PredictionCollector object
                inferenceResultPromises.push(new Promise((res) => {
                    res({ [n]: preds });
                }));
                collectPredictions();
                console.log(`${n} predictions: `, preds);
            }
        };
    });
}

function collectPredictions() {
    if (inferenceResultPromises.length == modelNames.length) {
        Promise.all(inferenceResultPromises).then((predictions) => {
            const allPredictions = {};
            Object.assign(allPredictions, ...predictions);
            resultsViz.updateMeters(allPredictions);
            resultsViz.updateValueBoxes(essentiaAnalysis);

            // store results in history
            analysedTracks.push({
                file: currentAnalysingFile,
                predictions: allPredictions,
                essentia: essentiaAnalysis
            });
            addTrackToHistory(analysedTracks.length - 1, currentAnalysingFile.name);

            toggleLoader();
            controls.toggleEnabled(true)

            // terminate existing inference workers and create fresh ones for next audio to
            // ensure models are reloaded (workers dispose models after inference)
            Object.values(inferenceWorkers).forEach(w => w.terminate());
            inferenceWorkers = {};
            createInferenceWorkers();

            // proceed with next file in queue (if any)
            inferenceResultPromises = []; // clear array first
            queueNextFile();
        })
    }
}

function toggleLoader() {
    const loader = document.querySelector('#loader');
    loader.classList.toggle('disabled');
    loader.classList.toggle('active')
}

function addTrackToHistory(index, name) {
    const list = document.querySelector('#track-list');
    if (!list) return;
    const li = document.createElement('li');
    li.textContent = name;
    li.dataset.index = index;
    li.style.cursor = 'pointer';
    li.addEventListener('click', () => {
        loadTrackFromHistory(Number(li.dataset.index));
    });
    list.appendChild(li);
    
    // Update CSV button state when new track is added
    updateCSVButtonState();
}

function loadTrackFromHistory(index) {
    const track = analysedTracks[index];
    if (!track) return;
    if (wavesurfer) {
        wavesurfer.loadBlob(track.file);
    }
    // update UI with stored results
    resultsViz.updateMeters(track.predictions);
    resultsViz.updateValueBoxes(track.essentia);
    if (controls) controls.toggleEnabled(true);
}

window.onload = () => {
    createInferenceWorkers();
    EssentiaWASM().then((wasmModule) => {
        essentia = new wasmModule.EssentiaJS(false);
        essentia.arrayToVector = wasmModule.arrayToVector;
    });
    
    // Make CSV export functions and data available globally for testing
    window.csvExport = {
        generateCSV: generateCSV,
        downloadCSV: downloadCSV,
        exportCSV: exportCSV,
        schema: CSV_SCHEMA,
        getAnalysedTracks: () => analysedTracks
    };
    
    console.log('CSV export functionality initialized. Use window.csvExport to access functions.');
    
    initializeCSVDownloadUI();
};
