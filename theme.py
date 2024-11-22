light_theme = """
* {
	border: none;
    padding: 0px;
    margin: 0px;
    background-color: transparent;
    font-family: "Segoe UI";
}

QToolTip {
	color: #000000;
	background-color: #DFE0E2;
	background-image: none;
	background-position: left center;
    background-repeat: no-repeat;
	border: none;
	/* border-left: 2px solid rgb(255, 121, 198); */
	text-align: left;
	padding-left: 8px;
	margin: 0px;
}

QPushButton {
    color: #071013;
}

QLabel {
    color: #071013;
}

#mainBody{
	background: #DFE0E2
}

#errPage{
	background: #DFE0E2
}

#errPage QLabel{
    font-family: "Here Be Dubstep";
	font-size: 48px
}

#loadingPage{
	background: #DFE0E2
}

#loadingPage QLabel{
    font-family: "Here Be Dubstep";
	font-size: 48px
}

#seekPrevBtn, #seekNxtBtn{
	background: #cec9d1;
	border-radius: 14px;
}

#seekPrevBtn:hover, #seekNxtBtn:hover{
	background: #eeeeee;
	border-radius: 14px;
}

#seekPrevBtn:pressed, #seekNxtBtn:pressed{
	background: #aaaaaa;
	border-radius: 14px;
}

#header{
	background: #216869;
}

#header QLabel{
	font-family: "Here Be Dubstep";
	color: #ffffff;
	font-size: 56px;
	margin: 4px 0px;
}

#themeBtn:hover{
	background: #829191;
	border-radius: 4px;
}

#themeBtn:pressed{
	background: #1D70A2;
	border-radius: 4px;
}

#minimizeBtn:hover{
	background: #333333;
}

#minimizeBtn:pressed{
	background: #1D70A2;
}

#closeBtn{
	background: #ff5555;
}

#closeBtn:hover{
	background: #ff2222;
}

#closeBtn:pressed{
	background: #d00000;
}

#minimizeBtn{
	background: #829191;
}

#footer{
	background: #4DA0AE
}

#githubBtn{
	margin-top: 2px;
}

#githubBtn:hover{
	background: #000000;
	border-radius: 4px;
}

#githubBtn:pressed{
	background: #5fb4e6;
	border-radius: 4px;
}

#footer QLabel{
	color: #F1FAEE;
	margin: 2px 4px;
}

#controlWidget{
	background: #bdb8c0;
	border-radius: 8px;
}

#controlWidget QPushButton:hover{
	background: #aaaaaa;
	border-radius: 4px;
}

#controlWidget QPushButton:pressed{
	background: #888888;
	border-radius: 4px;
}

#analyzingWidget QLabel{
	font-size: 32px
}

#mediaPlayer{
	background: #bdb8c0;
	border-radius: 8px;
}

#mediaPlayer QSlider {
	background: transparent;
    height: 6px;
}

#mediaPlayer QSlider::groove:horizontal {
    border: none;
    height: 6px;
    background: #DFE0E2;
    border-radius: 3px;
}

#mediaPlayer QSlider::handle:horizontal {
    width: 6px;
    background: #0E1C36;
    border-radius: 3px;
}

#mediaPlayer QSlider::sub-page:horizontal {
    background: #12a4c2;
	margin-left: 2px;
	width: 6px;
    border-radius: 3px;
}

#mediaMuteBtn:hover{
	background: #aaaaaa;
	border-radius: 4px;
}

#mediaMuteBtn:pressed{
	background: #888888;
	border-radius: 4px;
}

#mediaTitleLabel{
    font-size: 16px
}

#currentChordBtn{
	background: #23B5D3;
	border-radius: 8px;
	font-size: 45px;
    font-weight: bold
}

#nxtChordBtn, #prevChordBtn{
	background: #12a4c2;
	border-radius: 8px;
	font-size: 34px;
    font-weight: bold
}

#postNxtChordBtn, #prePrevChordBtn{
	background: #12a4c2;
	border-radius: 8px;
	font-size: 22px;
    font-weight: bold
}

#keyLabel{
	font-size:14px;
}

#chordSlider {
	background: transparent;
    height: 4px;
    margin-left: 8px;
    margin-right: 8px;
}

#chordSlider::groove:horizontal {
    border: none;
    height: 4px;
    background: #bdb8c0;
    border-radius: 2px;
}

#chordSlider::handle:horizontal {
    width: 4px;
    background: #0E1C36;
    border-radius: 2px;
}

#chordSlider::sub-page:horizontal {
    background: #12a4c2;
	margin-left: 2px;
	width: 6px;
    border-radius: 2px;
}
"""

dark_theme = """
* {
	border: none;
    padding: 0px;
    margin: 0px;
    background-color: transparent;
    font-family: "Segoe UI";
}

QToolTip {
	color: #999999;
	background-color: #071013;
	background-image: none;
	background-position: left center;
    background-repeat: no-repeat;
	border: none;
	text-align: left;
	padding-left: 8px;
	margin: 0px;
}

QPushButton {
    color: #DFE0E2;
}

QLabel {
    color: #DFE0E2;
}

#mainBody{
	background: #071013
}

#errPage{
	background: #071013
}

#errPage QLabel{
    font-family: "Here Be Dubstep";
	font-size: 48px
}

#loadingPage{
	background: #071013
}

#loadingPage QLabel{
    font-family: "Here Be Dubstep";
	font-size: 48px
}

#seekPrevBtn, #seekNxtBtn{
	background: #F75C03;
	border-radius: 14px;
}

#seekPrevBtn:hover, #seekNxtBtn:hover{
	background: #15201b;
	border-radius: 14px;
}

#seekPrevBtn:pressed, #seekNxtBtn:pressed{
	background: #555555;
	border-radius: 14px;
}

#header{
	background: #010101;
}

#header QLabel{
	font-family: "Here Be Dubstep";
	color: #ffffff;
	font-size: 56px;
	margin: 4px 0px;
}

#themeBtn:hover{
	background: #333333;
	border-radius: 4px;
}

#themeBtn:pressed{
	background: #1D70A2;
	border-radius: 4px;
}

#minimizeBtn:hover{
	background: #333333;
}

#minimizeBtn:pressed{
	background: #111111;
}

#closeBtn{
	background: #d00000;
}

#closeBtn:hover{
	background: #990000;
}

#closeBtn:pressed{
	background: #660000;
}

#minimizeBtn{
	background: #222222;
}

#footer{
	background: #010101
}

#githubBtn{
	margin-top: 2px;
}

#githubBtn:hover{
	background: #555555;
	border-radius: 4px;
}

#githubBtn:pressed{
	background: #15201b;
	border-radius: 4px;
}

#footer QLabel{
	color: #F1FAEE;
	margin: 2px 4px;
}

#controlWidget{
	background: #191D32;
	border-radius: 8px;
}

#controlWidget QPushButton:hover{
	background: #666666;
	border-radius: 4px;
}

#controlWidget QPushButton:pressed{
	background: #000000;
	border-radius: 4px;
}

#analyzingWidget QLabel{
	font-size: 32px
}

#mediaPlayer{
	background: #191D32;
	border-radius: 8px;
}

#mediaPlayer QSlider {
	background: transparent;
    height: 6px;
}

#mediaPlayer QSlider::groove:horizontal {
    border: none;
    height: 6px;
    background: #454545;
    border-radius: 3px;
}

#mediaPlayer QSlider::handle:horizontal {
    width: 6px;
    background: #0E1C36;
    border-radius: 3px;
}

#mediaPlayer QSlider::sub-page:horizontal {
    background: #706993;
	margin-left: 2px;
	width: 6px;
    border-radius: 3px;
}

#mediaMuteBtn:hover{
	background: #aaaaaa;
	border-radius: 4px;
}

#mediaMuteBtn:pressed{
	background: #888888;
	border-radius: 4px;
}

#mediaTitleLabel{
    font-size: 16px
}

#currentChordBtn{
	background: #440D44;
	border-radius: 8px;
	font-size: 45px;
    font-weight: bold
}

#nxtChordBtn, #prevChordBtn{
	background: #330D33;
	border-radius: 8px;
	font-size: 34px;
    font-weight: bold
}

#postNxtChordBtn, #prePrevChordBtn{
	background: #330D33;
	border-radius: 8px;
	font-size: 22px;
    font-weight: bold
}

#keyLabel{
	font-size:14px;
}

#chordSlider {
	background: transparent;
    height: 4px;
    margin-left: 8px;
    margin-right: 8px;
}

#chordSlider::groove:horizontal {
    border: none;
    height: 4px;
    background: #191D32;
    border-radius: 2px;
}

#chordSlider::handle:horizontal {
    width: 4px;
    background: #0E1C36;
    border-radius: 2px;
}

#chordSlider::sub-page:horizontal {
    background: #706993;
	margin-left: 2px;
	width: 6px;
    border-radius: 2px;
}
"""
