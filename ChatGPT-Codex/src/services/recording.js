// No saved meeting recording. Live mode still uses MediaRecorder for transient
// speech segments sent to Part B; it is not a saved meeting recording.
export const RECORDING_AVAILABLE = false;
export const recordingState = () => ({ available: false, recording: false, label: 'No saved recording' });
