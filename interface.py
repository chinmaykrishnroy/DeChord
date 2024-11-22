# -*- coding: utf-8 -*-

################################################################################
## Form generated from reading UI file 'interfacelwTtmQ.ui'
##
## Created by: Qt User Interface Compiler version 6.4.3
##
## WARNING! All changes made in this file will be lost when recompiling UI file!
################################################################################

from PyQt5.QtCore import (QCoreApplication, QDate, QDateTime, QLocale,
    QMetaObject, QObject, QPoint, QRect, QTimer,
    QSize, QTime, QUrl, Qt)
from PyQt5.QtGui import (QBrush, QColor, QConicalGradient, QCursor,
    QFont, QFontDatabase, QGradient, QIcon, QFontDatabase, QDragEnterEvent, 
    QDropEvent, QImage, QKeySequence, QLinearGradient, QPainter, QMovie,
    QPalette, QPixmap, QRadialGradient, QTransform)
from PyQt5.QtWidgets import (QApplication, QFrame, QHBoxLayout, QLabel,
    QMainWindow, QPushButton, QSizePolicy, QSlider, QFileDialog,
    QSpacerItem, QStackedWidget, QVBoxLayout, QWidget)
from PyQt5.QtMultimedia import QMediaPlayer, QMediaContent
import res
from theme import light_theme, dark_theme
import os


class SeekSlider(QSlider):
    def __init__(self, orientation, parent=None):
        super().__init__(orientation, parent)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton:
            value = self.minimum() + ((self.maximum() - self.minimum()) * event.x()) / self.width()
            self.setValue(int(value))
            self.sliderMoved.emit(int(value))
        super().mousePressEvent(event)


class Ui_MainWindow(object):
    def setupUi(self, MainWindow):
        if not MainWindow.objectName():
            MainWindow.setObjectName(u"MainWindow")
        MainWindow.resize(448, 405)
        MainWindow.setStyleSheet(dark_theme)
        self.centralwidget = QWidget(MainWindow)
        # font_id = QFontDatabase.addApplicationFont(":/fonts/the-score-font/TheScoreNormal-BWpx.ttf")
        # font_family = QFontDatabase.applicationFontFamilies(font_id)
        # print(font_family)
        QFontDatabase.addApplicationFont(":/fonts/here-be-dubstep-font/HereBeDubstepRegular-JDaB.ttf")
        self.centralwidget.setObjectName(u"centralwidget")
        self.verticalLayout = QVBoxLayout(self.centralwidget)
        self.verticalLayout.setSpacing(0)
        self.verticalLayout.setObjectName(u"verticalLayout")
        self.verticalLayout.setContentsMargins(0, 0, 0, 0)
        self.header = QWidget(self.centralwidget)
        self.header.setObjectName(u"header")
        self.horizontalLayout_3 = QHBoxLayout(self.header)
        self.horizontalLayout_3.setSpacing(0)
        self.horizontalLayout_3.setObjectName(u"horizontalLayout_3")
        self.horizontalLayout_3.setContentsMargins(0, 0, 0, 0)
        self.appIconLabel = QLabel(self.header)
        self.appIconLabel.setObjectName(u"appIconLabel")
        self.appIconLabel.setMaximumSize(QSize(32,32))
        self.appIconLabel.setPixmap(QPixmap(u":/icons/chord.png"))

        self.horizontalLayout_3.addWidget(self.appIconLabel)

        self.appNameLabel = QLabel(self.header)
        self.appNameLabel.setObjectName(u"appNameLabel")

        self.horizontalLayout_3.addWidget(self.appNameLabel, 0, Qt.AlignLeft|Qt.AlignVCenter)

        self.headerSpacerMain = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout_3.addItem(self.headerSpacerMain)

        self.themeBtn = QPushButton(self.header)
        self.themeBtn.setObjectName(u"themeBtn")
        sizePolicy = QSizePolicy(QSizePolicy.Minimum, QSizePolicy.Fixed)
        sizePolicy.setHorizontalStretch(0)
        sizePolicy.setVerticalStretch(0)
        sizePolicy.setHeightForWidth(self.themeBtn.sizePolicy().hasHeightForWidth())
        self.themeBtn.setSizePolicy(sizePolicy)
        self.themeBtn.setMinimumSize(QSize(0, 24))
        icon = QIcon()
        icon.addFile(u":/icons/sun.svg", QSize(), QIcon.Normal, QIcon.Off)
        self.themeBtn.setIcon(icon)
        self.themeBtn.setIconSize(QSize(20, 20))

        self.horizontalLayout_3.addWidget(self.themeBtn, 0, Qt.AlignRight|Qt.AlignVCenter)

        self.headerSpacer2 = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout_3.addItem(self.headerSpacer2)

        self.appControlWidget = QWidget(self.header)
        self.appControlWidget.setObjectName(u"appControlWidget")
        self.horizontalLayout_2 = QHBoxLayout(self.appControlWidget)
        self.horizontalLayout_2.setSpacing(0)
        self.horizontalLayout_2.setObjectName(u"horizontalLayout_2")
        self.horizontalLayout_2.setContentsMargins(0, 0, 0, 0)
        self.minimizeBtn = QPushButton(self.appControlWidget)
        self.minimizeBtn.setObjectName(u"minimizeBtn")
        self.minimizeBtn.setMinimumSize(QSize(32, 32))
        self.minimizeBtn.setMaximumSize(QSize(32, 32))
        icon1 = QIcon()
        icon1.addFile(u":/icons/minus.svg", QSize(), QIcon.Normal, QIcon.Off)
        self.minimizeBtn.setIcon(icon1)

        self.horizontalLayout_2.addWidget(self.minimizeBtn, 0, Qt.AlignRight|Qt.AlignTop)

        self.closeBtn = QPushButton(self.appControlWidget)
        self.closeBtn.setObjectName(u"closeBtn")
        self.closeBtn.setMinimumSize(QSize(32, 32))
        self.closeBtn.setMaximumSize(QSize(32, 32))
        icon2 = QIcon()
        icon2.addFile(u":/icons/x.svg", QSize(), QIcon.Normal, QIcon.Off)
        self.closeBtn.setIcon(icon2)

        self.horizontalLayout_2.addWidget(self.closeBtn, 0, Qt.AlignRight|Qt.AlignTop)


        self.horizontalLayout_3.addWidget(self.appControlWidget, 0, Qt.AlignRight)

        self.horizontalLayout_3.setStretch(1, 5)

        self.verticalLayout.addWidget(self.header, 0, Qt.AlignTop)

        self.appStacks = QStackedWidget(self.centralwidget)
        self.appStacks.setObjectName(u"appStacks")
        self.mainPage = QWidget()
        self.mainPage.setObjectName(u"mainPage")
        self.verticalLayout_3 = QVBoxLayout(self.mainPage)
        self.verticalLayout_3.setSpacing(0)
        self.verticalLayout_3.setObjectName(u"verticalLayout_3")
        self.verticalLayout_3.setContentsMargins(0, 0, 0, 0)
        self.mainBody = QWidget(self.mainPage)
        self.mainBody.setObjectName(u"mainBody")
        self.verticalLayout_2 = QVBoxLayout(self.mainBody)
        self.verticalLayout_2.setObjectName(u"verticalLayout_2")
        self.controlWidget = QWidget(self.mainBody)
        self.controlWidget.setObjectName(u"controlWidget")
        self.verticalLayout_5 = QVBoxLayout(self.controlWidget)
        self.verticalLayout_5.setSpacing(4)
        self.verticalLayout_5.setObjectName(u"verticalLayout_5")
        self.verticalLayout_5.setContentsMargins(8, 8, 8, 8)
        self.mediaHandleFrame = QFrame(self.controlWidget)
        self.mediaHandleFrame.setObjectName(u"mediaHandleFrame")
        self.mediaHandleFrame.setFrameShape(QFrame.StyledPanel)
        self.mediaHandleFrame.setFrameShadow(QFrame.Raised)
        self.horizontalLayout_8 = QHBoxLayout(self.mediaHandleFrame)
        self.horizontalLayout_8.setSpacing(0)
        self.horizontalLayout_8.setObjectName(u"horizontalLayout_8")
        self.horizontalLayout_8.setContentsMargins(0, 0, 0, 0)
        self.mediaOpenBtn = QPushButton(self.mediaHandleFrame)
        self.mediaOpenBtn.setObjectName(u"mediaOpenBtn")
        icon3 = QIcon()
        icon3.addFile(u":/icons/folder.svg", QSize(), QIcon.Normal, QIcon.Off)
        self.mediaOpenBtn.setIcon(icon3)
        self.mediaOpenBtn.setIconSize(QSize(36, 36))

        self.horizontalLayout_8.addWidget(self.mediaOpenBtn, 0, Qt.AlignLeft)

        self.mediaFeatFrame = QFrame(self.mediaHandleFrame)
        self.mediaFeatFrame.setObjectName(u"mediaFeatFrame")
        self.mediaFeatFrame.setMaximumSize(QSize(16777215, 16777215))
        self.mediaFeatFrame.setFrameShape(QFrame.StyledPanel)
        self.mediaFeatFrame.setFrameShadow(QFrame.Raised)
        self.verticalLayout_7 = QVBoxLayout(self.mediaFeatFrame)
        self.verticalLayout_7.setSpacing(0)
        self.verticalLayout_7.setObjectName(u"verticalLayout_7")
        self.verticalLayout_7.setContentsMargins(0, 0, 0, 0)
        self.saveChordsBtn = QPushButton(self.mediaFeatFrame)
        self.saveChordsBtn.setObjectName(u"saveChordsBtn")
        icon4 = QIcon()
        icon4.addFile(u":/icons/upload.svg", QSize(), QIcon.Normal, QIcon.Off)
        self.saveChordsBtn.setIcon(icon4)
        self.saveChordsBtn.setIconSize(QSize(22, 22))

        self.verticalLayout_7.addWidget(self.saveChordsBtn, 0, Qt.AlignHCenter|Qt.AlignVCenter)

        self.keyLabel = QLabel(self.mediaFeatFrame)
        self.keyLabel.setObjectName(u"keyLabel")
        self.keyLabel.setAlignment(Qt.AlignCenter)

        self.verticalLayout_7.addWidget(self.keyLabel)
        #
        self.chordSlider = QSlider(self.mediaFeatFrame)
        self.chordSlider.setObjectName(u"chordSlider")
        self.chordSlider.setOrientation(Qt.Horizontal)

        self.verticalLayout_7.addWidget(self.chordSlider)
        #

        self.horizontalLayout_8.addWidget(self.mediaFeatFrame)

        self.mediaPlayBtn = QPushButton(self.mediaHandleFrame)
        self.mediaPlayBtn.setObjectName(u"mediaPlayBtn")
        icon5 = QIcon()
        icon5.addFile(u":/icons/play.svg", QSize(), QIcon.Normal, QIcon.Off)
        self.mediaPlayBtn.setIcon(icon5)
        self.mediaPlayBtn.setIconSize(QSize(36, 36))

        self.horizontalLayout_8.addWidget(self.mediaPlayBtn, 0, Qt.AlignRight)


        self.verticalLayout_5.addWidget(self.mediaHandleFrame)


        self.verticalLayout_2.addWidget(self.controlWidget, 0, Qt.AlignTop)

        self.chordsWidget = QWidget(self.mainBody)
        self.chordsWidget.setObjectName(u"chordsWidget")
        self.chordsWidget.setMaximumSize(QSize(16777215, 16777215))
        self.chordsWidgetHLayout = QHBoxLayout(self.chordsWidget)
        self.chordsWidgetHLayout.setSpacing(4)
        self.chordsWidgetHLayout.setObjectName(u"chordsWidgetHLayout")
        self.chordsWidgetHLayout.setContentsMargins(0, 0, 0, 0)
        self.seekPrevBtn = QPushButton(self.chordsWidget)
        self.seekPrevBtn.setObjectName(u"seekPrevBtn")
        self.seekPrevBtn.setMinimumSize(QSize(28, 28))
        icon6 = QIcon()
        icon6.addFile(u":/icons/left-arrow-svgrepo-com.svg", QSize(), QIcon.Normal, QIcon.Off)
        self.seekPrevBtn.setIcon(icon6)
        self.seekPrevBtn.setIconSize(QSize(24, 24))

        self.chordsWidgetHLayout.addWidget(self.seekPrevBtn, 0, Qt.AlignLeft)

        self.prePrevChordBtn = QPushButton(self.chordsWidget)
        self.prePrevChordBtn.setObjectName(u"prePrevChordBtn")
        self.prePrevChordBtn.setMinimumSize(QSize(50, 50))
        self.prePrevChordBtn.setMaximumSize(QSize(1000, 1000))

        self.chordsWidgetHLayout.addWidget(self.prePrevChordBtn, 0, Qt.AlignVCenter)

        self.prevChordBtn = QPushButton(self.chordsWidget)
        self.prevChordBtn.setObjectName(u"prevChordBtn")
        self.prevChordBtn.setMinimumSize(QSize(75, 75))
        self.prevChordBtn.setMaximumSize(QSize(1000, 1000))

        self.chordsWidgetHLayout.addWidget(self.prevChordBtn, 0, Qt.AlignVCenter)

        self.currentChordBtn = QPushButton(self.chordsWidget)
        self.currentChordBtn.setObjectName(u"currentChordBtn")
        self.currentChordBtn.setMinimumSize(QSize(100, 100))
        self.currentChordBtn.setMaximumSize(QSize(1000, 1000))

        self.chordsWidgetHLayout.addWidget(self.currentChordBtn, 0, Qt.AlignVCenter)

        self.nxtChordBtn = QPushButton(self.chordsWidget)
        self.nxtChordBtn.setObjectName(u"nxtChordBtn")
        self.nxtChordBtn.setMinimumSize(QSize(75, 75))
        self.nxtChordBtn.setMaximumSize(QSize(1000, 1000))

        self.chordsWidgetHLayout.addWidget(self.nxtChordBtn, 0, Qt.AlignVCenter)

        self.postNxtChordBtn = QPushButton(self.chordsWidget)
        self.postNxtChordBtn.setObjectName(u"postNxtChordBtn")
        self.postNxtChordBtn.setMinimumSize(QSize(50, 50))
        self.postNxtChordBtn.setMaximumSize(QSize(1000, 1000))

        self.chordsWidgetHLayout.addWidget(self.postNxtChordBtn, 0, Qt.AlignVCenter)

        self.seekNxtBtn = QPushButton(self.chordsWidget)
        self.seekNxtBtn.setObjectName(u"seekNxtBtn")
        self.seekNxtBtn.setMinimumSize(QSize(28, 28))
        icon7 = QIcon()
        icon7.addFile(u":/icons/right-arrow-svgrepo-com.svg", QSize(), QIcon.Normal, QIcon.Off)
        self.seekNxtBtn.setIcon(icon7)
        self.seekNxtBtn.setIconSize(QSize(24, 24))

        self.chordsWidgetHLayout.addWidget(self.seekNxtBtn, 0, Qt.AlignRight)


        self.verticalLayout_2.addWidget(self.chordsWidget)

        self.mediaPlayer = QWidget(self.mainBody)
        self.mediaPlayer.setObjectName(u"mediaPlayer")
        self.verticalLayout_4 = QVBoxLayout(self.mediaPlayer)
        self.verticalLayout_4.setSpacing(4)
        self.verticalLayout_4.setObjectName(u"verticalLayout_4")
        self.verticalLayout_4.setContentsMargins(8, 8, 8, 8)
        self.mediaProgressFrame = QFrame(self.mediaPlayer)
        self.mediaProgressFrame.setObjectName(u"mediaProgressFrame")
        self.mediaProgressFrame.setFrameShape(QFrame.StyledPanel)
        self.mediaProgressFrame.setFrameShadow(QFrame.Raised)
        self.horizontalLayout_5 = QHBoxLayout(self.mediaProgressFrame)
        self.horizontalLayout_5.setSpacing(8)
        self.horizontalLayout_5.setObjectName(u"horizontalLayout_5")
        self.horizontalLayout_5.setContentsMargins(0, 0, 0, 0)
        self.currentPlayedLabel = QLabel(self.mediaProgressFrame)
        self.currentPlayedLabel.setMinimumWidth(32)
        self.currentPlayedLabel.setObjectName(u"currentPlayedLabel")
        self.currentPlayedLabel.setAlignment(Qt.AlignCenter)

        self.horizontalLayout_5.addWidget(self.currentPlayedLabel)

        self.mediaProgressSlider = SeekSlider(Qt.Horizontal, parent=self.mediaProgressFrame)
        self.mediaProgressSlider.setObjectName(u"mediaProgressSlider")
        self.mediaProgressSlider.setMinimumSize(QSize(200, 0))
        self.mediaProgressSlider.setOrientation(Qt.Horizontal)
        self.mediaProgressSlider.setCursor(Qt.PointingHandCursor)

        self.horizontalLayout_5.addWidget(self.mediaProgressSlider)

        self.mediaDurationLabel = QLabel(self.mediaProgressFrame)
        self.mediaDurationLabel.setMinimumWidth(32)
        self.mediaDurationLabel.setObjectName(u"mediaDurationLabel")
        self.mediaDurationLabel.setAlignment(Qt.AlignCenter)

        self.horizontalLayout_5.addWidget(self.mediaDurationLabel)


        self.verticalLayout_4.addWidget(self.mediaProgressFrame)

        self.mediaInfoFrame = QFrame(self.mediaPlayer)
        self.mediaInfoFrame.setObjectName(u"mediaInfoFrame")
        self.mediaInfoFrame.setFrameShape(QFrame.StyledPanel)
        self.mediaInfoFrame.setFrameShadow(QFrame.Raised)
        self.horizontalLayout_6 = QHBoxLayout(self.mediaInfoFrame)
        self.horizontalLayout_6.setSpacing(8)
        self.horizontalLayout_6.setObjectName(u"horizontalLayout_6")
        self.horizontalLayout_6.setContentsMargins(0, 0, 0, 0)
        self.mediaTitleLabel = QLabel(self.mediaInfoFrame)
        self.mediaTitleLabel.setObjectName(u"mediaTitleLabel")
        self.mediaTitleLabel.setMaximumWidth(300)

        self.horizontalLayout_6.addWidget(self.mediaTitleLabel)

        self.horizontalSpacer = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout_6.addItem(self.horizontalSpacer)

        self.mediaMuteBtn = QPushButton(self.mediaInfoFrame)
        self.mediaMuteBtn.setObjectName(u"mediaMuteBtn")
        icon8 = QIcon()
        icon8.addFile(u":/icons/volume-2.svg", QSize(), QIcon.Normal, QIcon.Off)
        self.mediaMuteBtn.setIcon(icon8)
        self.mediaMuteBtn.setIconSize(QSize(16, 16))

        self.horizontalLayout_6.addWidget(self.mediaMuteBtn, 0, Qt.AlignRight)

        self.volumeSlider = SeekSlider(Qt.Horizontal, parent=self.mediaInfoFrame)
        self.volumeSlider.setObjectName(u"volumeSlider")
        self.volumeSlider.setOrientation(Qt.Horizontal)
        self.volumeSlider.setCursor(Qt.PointingHandCursor)

        self.horizontalLayout_6.addWidget(self.volumeSlider, 0, Qt.AlignRight)


        self.verticalLayout_4.addWidget(self.mediaInfoFrame)


        self.verticalLayout_2.addWidget(self.mediaPlayer, 0, Qt.AlignBottom)


        self.verticalLayout_3.addWidget(self.mainBody)

        self.appStacks.addWidget(self.mainPage)
        self.loadingPage = QWidget()
        self.loadingPage.setObjectName(u"loadingPage")
        self.verticalLayout_6 = QVBoxLayout(self.loadingPage)
        self.verticalLayout_6.setObjectName(u"verticalLayout_6")
        self.widget = QWidget(self.loadingPage)
        self.widget.setObjectName(u"widget")
        self.verticalLayout_8 = QVBoxLayout(self.widget)
        self.verticalLayout_8.setSpacing(0)
        self.verticalLayout_8.setObjectName(u"verticalLayout_8")
        self.verticalLayout_8.setContentsMargins(0, 0, 0, 0)
        self.frame = QFrame(self.widget)
        self.frame.setObjectName(u"frame")
        self.frame.setFrameShape(QFrame.StyledPanel)
        self.frame.setFrameShadow(QFrame.Raised)
        self.verticalLayout_9 = QVBoxLayout(self.frame)
        self.verticalLayout_9.setObjectName(u"verticalLayout_9")
        self.label = QLabel(self.frame)
        self.label.setObjectName(u"label")
        self.label.setAlignment(Qt.AlignCenter)
        self.loadingGif = QMovie(u":/gif/1479.gif")
        self.label.setMovie(self.loadingGif)

        self.verticalLayout_9.addWidget(self.label)

        self.label_2 = QLabel(self.frame)
        self.label_2.setObjectName(u"label_2")
        self.label_2.setAlignment(Qt.AlignCenter)

        self.verticalLayout_9.addWidget(self.label_2)


        self.verticalLayout_8.addWidget(self.frame)


        self.verticalLayout_6.addWidget(self.widget, 0, Qt.AlignHCenter|Qt.AlignVCenter)

        self.appStacks.addWidget(self.loadingPage)

        self.errPage = QWidget()
        self.errPage.setObjectName(u"errPage")
        self.verticalLayout_10 = QVBoxLayout(self.errPage)
        self.verticalLayout_10.setSpacing(0)
        self.verticalLayout_10.setObjectName(u"verticalLayout_10")
        self.verticalLayout_10.setContentsMargins(0, 0, 0, 0)
        self.errWidget = QWidget(self.errPage)
        self.errWidget.setObjectName(u"errWidget")
        self.horizontalLayout_7 = QHBoxLayout(self.errWidget)
        self.horizontalLayout_7.setSpacing(8)
        self.horizontalLayout_7.setObjectName(u"horizontalLayout_7")
        self.horizontalLayout_7.setContentsMargins(0, 0, 0, 0)
        self.errIconLabel = QLabel(self.errWidget)
        self.errIconLabel.setObjectName(u"errIconLabel")
        self.errIconLabel.setMinimumSize(QSize(64, 64))
        self.errGif = QMovie(u":/gif/1483 (1).gif")
        self.errIconLabel.setMovie(self.errGif)

        self.horizontalLayout_7.addWidget(self.errIconLabel)

        self.errLabel = QLabel(self.errWidget)
        self.errLabel.setObjectName(u"errLabel")

        self.horizontalLayout_7.addWidget(self.errLabel)


        self.verticalLayout_10.addWidget(self.errWidget, 0, Qt.AlignHCenter|Qt.AlignVCenter)

        self.appStacks.addWidget(self.errPage)

        self.verticalLayout.addWidget(self.appStacks)

        self.footer = QWidget(self.centralwidget)
        self.footer.setObjectName(u"footer")
        self.horizontalLayout = QHBoxLayout(self.footer)
        self.horizontalLayout.setSpacing(0)
        self.horizontalLayout.setObjectName(u"horizontalLayout")
        self.horizontalLayout.setContentsMargins(0, 0, 0, 0)
        self.authorLabel = QLabel(self.footer)
        self.authorLabel.setObjectName(u"authorLabel")

        self.horizontalLayout.addWidget(self.authorLabel)

        self.footerSpacer = QSpacerItem(40, 20, QSizePolicy.Expanding, QSizePolicy.Minimum)

        self.horizontalLayout.addItem(self.footerSpacer)

        self.githubBtn = QPushButton(self.footer)
        self.githubBtn.setObjectName(u"githubBtn")
        self.githubBtn.setMaximumSize(QSize(16, 16))
        icon9 = QIcon()
        icon9.addFile(u":/icons/github.svg", QSize(), QIcon.Normal, QIcon.Off)
        self.githubBtn.setIcon(icon9)

        self.horizontalLayout.addWidget(self.githubBtn, 0, Qt.AlignRight)

        self.resizeFrame = QFrame(self.footer)
        self.resizeFrame.setObjectName(u"resizeFrame")
        self.resizeFrame.setMaximumSize(QSize(16, 16))
        self.horizontalLayout_4 = QHBoxLayout(self.resizeFrame)
        self.horizontalLayout_4.setSpacing(0)
        self.horizontalLayout_4.setObjectName(u"horizontalLayout_4")
        self.horizontalLayout_4.setContentsMargins(0, 0, 0, 0)
        self.resizeLabel = QLabel(self.resizeFrame)
        self.resizeLabel.setObjectName(u"resizeLabel")
        self.resizeLabel.setMinimumSize(QSize(16, 16))
        self.resizeLabel.setMaximumSize(QSize(16, 16))
        self.resizeLabel.setPixmap(QPixmap(u":/icons/cil-size-grip.png"))

        self.horizontalLayout_4.addWidget(self.resizeLabel, 0, Qt.AlignRight|Qt.AlignVCenter)


        self.horizontalLayout.addWidget(self.resizeFrame, 0, Qt.AlignRight|Qt.AlignVCenter)


        self.verticalLayout.addWidget(self.footer, 0, Qt.AlignBottom)

        MainWindow.setCentralWidget(self.centralwidget)

        self.retranslateUi(MainWindow)

        self.appStacks.setCurrentIndex(0)
        self.mediaProgressSlider.setEnabled(False)
        self.mediaPlayBtn.setEnabled(False)
        self.seekNxtBtn.setEnabled(False)
        self.seekPrevBtn.setEnabled(False)
        self.saveChordsBtn.setEnabled(False)
        self.chordSlider.setEnabled(False)
        self.keyLabel.hide()

        QMetaObject.connectSlotsByName(MainWindow)
    # setupUi

    def retranslateUi(self, MainWindow):
        MainWindow.setWindowTitle(QCoreApplication.translate("MainWindow", u"DeChord", None))
        self.appNameLabel.setText(QCoreApplication.translate("MainWindow", u"  DeChord !", None))
#if QT_CONFIG(tooltip)
        self.themeBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Toggle Theme", None))
#endif // QT_CONFIG(tooltip)
        self.themeBtn.setText("")
#if QT_CONFIG(tooltip)
        self.minimizeBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Minimize", None))
#endif // QT_CONFIG(tooltip)
        self.minimizeBtn.setText("")
#if QT_CONFIG(tooltip)
        self.closeBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Close", None))
#endif // QT_CONFIG(tooltip)
        self.closeBtn.setText("")
#if QT_CONFIG(tooltip)
        self.mediaOpenBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Open Media", None))
#endif // QT_CONFIG(tooltip)
        self.mediaOpenBtn.setText("")
#if QT_CONFIG(tooltip)
        self.saveChordsBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Export Chords as Text File", None))
#endif // QT_CONFIG(tooltip)
        self.saveChordsBtn.setText("")
#if QT_CONFIG(tooltip)
        self.keyLabel.setToolTip(QCoreApplication.translate("MainWindow", u"Key & Tempo", None))
#endif // QT_CONFIG(tooltip)
        self.keyLabel.setText(QCoreApplication.translate("MainWindow", u"", None))
#if QT_CONFIG(tooltip)
        self.mediaPlayBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Play/Pause", None))
#endif // QT_CONFIG(tooltip)
        self.mediaPlayBtn.setText("")
#if QT_CONFIG(tooltip)
        self.seekPrevBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Seek 10s Before", None))
#endif // QT_CONFIG(tooltip)
        self.seekPrevBtn.setText("")
#if QT_CONFIG(tooltip)
        self.prePrevChordBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Previous Before Previous Chord", None))
#endif // QT_CONFIG(tooltip)
        self.prePrevChordBtn.setText(QCoreApplication.translate("MainWindow", u"\U0001F319", None))
#if QT_CONFIG(tooltip)
        self.prevChordBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Previous Chord", None))
#endif // QT_CONFIG(tooltip)
        self.prevChordBtn.setText(QCoreApplication.translate("MainWindow", u"\u2600", None))
#if QT_CONFIG(tooltip)
        self.currentChordBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Current Chord", None))
#endif // QT_CONFIG(tooltip)
        self.currentChordBtn.setText(QCoreApplication.translate("MainWindow", u"\u2B50", None))
#if QT_CONFIG(tooltip)
        self.nxtChordBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Next Chord", None))
#endif // QT_CONFIG(tooltip)
        self.nxtChordBtn.setText(QCoreApplication.translate("MainWindow", u"\U0001F319", None))
#if QT_CONFIG(tooltip)
        self.postNxtChordBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Next After Next Chord", None))
#endif // QT_CONFIG(tooltip)
        self.postNxtChordBtn.setText(QCoreApplication.translate("MainWindow", u"\u2600", None))
#if QT_CONFIG(tooltip)
        self.seekNxtBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Seek 10s After", None))
#endif // QT_CONFIG(tooltip)
        self.seekNxtBtn.setText("")
#if QT_CONFIG(tooltip)
        self.mediaPlayer.setToolTip(QCoreApplication.translate("MainWindow", u"Total Duration", None))
#endif // QT_CONFIG(tooltip)
#if QT_CONFIG(tooltip)
        self.currentPlayedLabel.setToolTip(QCoreApplication.translate("MainWindow", u"Current Played", None))
#endif // QT_CONFIG(tooltip)
        self.currentPlayedLabel.setText(QCoreApplication.translate("MainWindow", u"00:00", None))
#if QT_CONFIG(tooltip)
        self.mediaProgressSlider.setToolTip(QCoreApplication.translate("MainWindow", u"Seek here", None))
#endif // QT_CONFIG(tooltip)
        self.mediaDurationLabel.setText(QCoreApplication.translate("MainWindow", u"00:00", None))
#if QT_CONFIG(tooltip)
        self.mediaTitleLabel.setToolTip(QCoreApplication.translate("MainWindow", u"Media Title", None))
#endif // QT_CONFIG(tooltip)
        self.mediaTitleLabel.setText(QCoreApplication.translate("MainWindow", u"Select/Drop a Song!", None))
#if QT_CONFIG(tooltip)
        self.mediaMuteBtn.setToolTip(QCoreApplication.translate("MainWindow", u"Mute/Unmute", None))
#endif // QT_CONFIG(tooltip)
        self.mediaMuteBtn.setText("")
#if QT_CONFIG(tooltip)
        self.volumeSlider.setValue(100)
        self.volumeSlider.setToolTip(QCoreApplication.translate("MainWindow", u"Change Volume", None))
#endif // QT_CONFIG(tooltip)
        self.label.setText("")
        self.label_2.setText(QCoreApplication.translate("MainWindow", u"Analyzing Chords", None))
        self.errIconLabel.setText("")
        self.errLabel.setText(QCoreApplication.translate("MainWindow", u"Analyzing Chords", None))
#if QT_CONFIG(tooltip)
        self.authorLabel.setToolTip(QCoreApplication.translate("MainWindow", u"Developer", None))
#endif // QT_CONFIG(tooltip)
        self.authorLabel.setText(QCoreApplication.translate("MainWindow", u"@chinmaykrishnroy", None))
#if QT_CONFIG(tooltip)
        self.githubBtn.setToolTip(QCoreApplication.translate("MainWindow", u"App Repository", None))
#endif // QT_CONFIG(tooltip)
        self.githubBtn.setText("")
#if QT_CONFIG(tooltip)
        self.resizeLabel.setToolTip(QCoreApplication.translate("MainWindow", u"", None))
#endif // QT_CONFIG(tooltip)
        self.resizeLabel.setText("")
    # retranslateUi
