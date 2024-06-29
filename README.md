# DeChord - Real-Time Music Key and Chord Recognition Tool

Welcome to DeChord! This application is designed for musicians, music enthusiasts, and anyone interested in analyzing the harmonic content of audio files. DeChord uses advanced music analysis algorithms to recognize the musical key and chords in an audio file and displays this information in real-time through an intuitive graphical user interface.

## Features

### Key and Chord Recognition
- **Key Recognition:** Detects the musical key of an audio file using the `madmom` library.
- **Chord Recognition:** Identifies chords in the audio file with start and end times, also using the `madmom` library.
- **Real-Time Display:** Shows the current, previous, and next chords in real-time as the audio plays.

### Audio Playback
- **Play/Pause:** Controls to play and pause the audio.
- **Seek:** Allows seeking forward and backward in the audio track.
- **Volume Control:** Adjustable volume control through a slider.
- **Mute:** Mute and unmute the audio.

### User Interface
- **Drag and Drop:** Supports dragging and dropping audio files into the application window.
- **Theme Toggle:** Switch between dark and light themes.
- **Progress Slider:** Displays and controls the current position within the audio file.
- **Key Display:** Shows the detected musical key.
- **Export Chords:** Export recognized chords to a text file.
- **Keyboard Shortcuts:** Various keyboard shortcuts for quick access to functions.

### Additional Features
- **GitHub Redirect:** Opens the GitHub repository in a web browser.
- **Exception Handling:** Custom exception handler to manage and print exceptions.

## Technology Stack

### Libraries and Frameworks
- **Python:** The primary programming language used for development.
- **PyQt5:** For building the graphical user interface.
- **madmom:** A library for music signal processing, used for key and chord recognition.

## Installation

### Prerequisites
- Python 3.7 or higher
- Pip (Python package installer)

### Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/chinmaykrishnroy/dechord.git
   cd dechord

2. **Create a virtual environment:**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows use `venv\Scripts\activate`

3. **Install the required dependencies:**
   ```bash
   python -m pip install PyQt5==5.15.10 git+https://github.com/CPJKU/madmom

4. **Run the application:**
   ```bash
   python main.py
   
5. **Use .bat file to run directly:**
   ```bash
   run.bat

## How to Use

### Loading an Audio File
- Click the **Open** button or use the **drag and drop** feature to load an audio file.
- Supported formats: `.wav`, `.mp3`, `.m4a`, `.aac`.

### Playback Controls
- **Play/Pause:** Use the play/pause button to start or pause the audio.
- **Seek:** Use the forward and backward buttons to seek 10 seconds ahead or back.
- **Mute:** Click the mute button to mute or unmute the audio.
- **Volume Control:** Adjust the volume using the slider.
- **Progress Slider:** Drag the slider to move to a different part of the audio file.

### Chord and Key Recognition
- The application will automatically start recognizing chords and the key when an audio file is loaded.
- The recognized chords will be displayed in real-time as the audio plays.
- The detected key will be displayed above the playback controls.

### Exporting Chords
- Click the **Save Chords** button to export the recognized chords to a text file.

### Toggling Theme
- Click the **Theme** button to switch between dark and light themes.

### Redirect to GitHub
- Click the **GitHub** button to open the project's GitHub repository in your web browser.

### Keyboard Shortcuts
- **Esc:** Close the application
- **-:** Minimize the application
- **T:** Toggle theme
- **P:** Play/Pause
- **Left Arrow:** Seek backward
- **Right Arrow:** Seek forward
- **M:** Mute/Unmute
- **O:** Open audio file
- **E:** Export chords
- **R:** Redirect to GitHub

## Code Structure

### Main Files and Directories
- **main.py:** The entry point of the application.
- **interface.py:** Contains the GUI layout and setup.
- **chords.py:** Functions and classes related to chord recognition.
- **key.py:** Functions and classes related to key recognition.
- **icons/:** Directory containing icon files.
- **export/:** Directory where exported chord files are saved.

### Key Classes
- **KeyRecognitionThread:** A thread for performing key recognition.
- **ChordRecognitionThread:** A thread for performing chord recognition.
- **Ui_MainWindow:** The class is for the application's user interface.
- **MainWindow:** The main window class for every other class's integration and features.

### Exception Handling
- A custom exception handler is set up to handle and print exceptions, making debugging easier.

## Customizing the Application

### Adding New Features
To add new features, you can extend the existing classes or add new ones. Ensure to update the GUI (`interface.py`) and connect the new functionalities appropriately.

### Modifying the Theme
To modify the themes, you can update the `dark_theme` and `light_theme` stylesheets in the `main.py` file.

## Contributing

### Reporting Issues
If you find any bugs or issues, please report them in the [Issues](https://github.com/chinmaykrishnroy/dechord/issues) section of the GitHub repository.

### Pull Requests
We welcome contributions! Please fork the repository and create a pull request with your changes. Ensure your code follows the existing coding style and includes appropriate documentation and tests.

### Coding Standards
- Follow PEP 8 guidelines for Python code.
- Document your code using docstrings.
- Write meaningful commit messages.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgements

### Libraries and Tools
- **madmom:** For music signal processing algorithms.
- **PyQt5:** For the GUI framework.
- **Python:** The programming language used.

### Inspiration
This project is inspired by the need for a user-friendly tool for musicians to analyze and learn music through real-time key and chord recognition.

## Contact

For any questions or suggestions, feel free to open an issue on the GitHub repository or contact the maintainer directly.

---

Thank you for using DeChord! We hope it helps you in your musical journey.
