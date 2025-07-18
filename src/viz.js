class AnalysisResults {
    constructor(classifierNames) {
        this.analysisMeters = {};
        this.bpmBox = document.querySelector('#bpm-value');
        this.keyBox = document.querySelector('#key-value');
        if (classifierNames instanceof Array) {
            this.names = classifierNames;
            classifierNames.forEach((n) => {
                this.analysisMeters[n] = document.querySelector(`#${n} > .classifier-meter`);
            });
        } else {
            throw TypeError("List of classifier names provided is not of type Array");
        }
    }

    updateMeters(values) {
        this.names.forEach((n) => {
            if (n === 'genre_dortmund' && typeof values[n] === 'object') {
                // Handle multi-class genre predictions
                this.updateGenrePredictions(values[n]);
            } else {
                // Handle binary mood predictions
                this.analysisMeters[n].style.setProperty('--meter-width', values[n]*100);
            }
        });
    }

    updateGenrePredictions(genreValues) {
        // Update individual genre values
        const genreLabels = ['alternative', 'blues', 'electronic', 'folkcountry', 'funksoulrnb', 'jazz', 'pop', 'raphiphop', 'rock'];
        genreLabels.forEach(genre => {
            const element = document.getElementById(`genre-${genre}`);
            if (element && genreValues[genre] !== undefined) {
                element.textContent = (genreValues[genre] * 100).toFixed(1) + '%';
            }
        });

        // Show the detailed genre breakdown
        const genrePredictions = document.getElementById('genre-predictions');
        if (genrePredictions) {
            genrePredictions.style.display = 'block';
        }

        // Update summary with top genre
        const topGenre = this.getTopGenre(genreValues);
        const summaryElement = document.getElementById('genre-dortmund-summary');
        if (summaryElement && topGenre) {
            summaryElement.textContent = `${topGenre.genre}: ${(topGenre.confidence * 100).toFixed(1)}%`;
        }
    }

    getTopGenre(genreValues) {
        let topGenre = null;
        let maxConfidence = 0;
        
        for (const [genre, confidence] of Object.entries(genreValues)) {
            if (confidence > maxConfidence) {
                maxConfidence = confidence;
                topGenre = genre;
            }
        }
        
        return topGenre ? { genre: topGenre, confidence: maxConfidence } : null;
    }

    updateValueBoxes(essentiaAnalysis) {
        const stringBpm = essentiaAnalysis.bpm.toString();
        const formattedBpm = stringBpm.slice(0, stringBpm.indexOf('.') + 2); // keep 1 decimal places only
        this.bpmBox.textContent = formattedBpm;
        this.keyBox.textContent = `${essentiaAnalysis.keyData.key} ${essentiaAnalysis.keyData.scale}`;
    }
}

function toggleUploadDisplayHTML(mode) {
    switch (mode) {
        case 'display':
            const fileDropArea = document.querySelector('#file-drop-area');
            const fileSelectArea = document.querySelector('#file-select-area');
            if (fileDropArea) {
                fileDropArea.remove();
            }
            const waveformDiv = document.createElement('div');
            waveformDiv.setAttribute('id', 'waveform');

            const controlsTemplate = document.querySelector('#playback-controls');

            fileSelectArea.appendChild(waveformDiv);
            fileSelectArea.appendChild(controlsTemplate.content.cloneNode(true));

            return WaveSurfer.create({
                container: '#waveform',
                progressColor: '#F7AF39',
                waveColor: '#a16607'
            });
        
        case 'upload':
            // remove #waveform
            // insert file-drop-area into file-select-area
    
        default:
            break;
    }
}

class PlaybackControls {
    constructor(wavesurferInstance) {
        this.controls = {
            backward: document.querySelector('#file-select-area #backward'),
            play: document.querySelector('#file-select-area #play'),
            forward: document.querySelector('#file-select-area #forward'),
            mute: document.querySelector('#file-select-area #mute')
        };

        // set click handlers
        this.controls.backward.onclick = () => { wavesurferInstance.skipBackward() };
        this.controls.play.onclick = () => { wavesurferInstance.playPause() };
        this.controls.forward.onclick = () => { wavesurferInstance.skipForward() };
        this.controls.mute.onclick = () => { wavesurferInstance.toggleMute() };
    }

    toggleEnabled(isEnabled) {
        if (isEnabled) {
            for (let c in this.controls) {
                this.controls[c].removeAttribute('disabled');
            }
        } else {
            for (let c in this.controls) {
                this.controls[c].setAttribute('disabled', '');
            }
        }
    }
}

export { AnalysisResults, toggleUploadDisplayHTML, PlaybackControls };