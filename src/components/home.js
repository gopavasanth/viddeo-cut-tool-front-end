import React, { Component, useContext } from 'react';
import { Alert, Tooltip, Steps, Divider, Input, Slider, Typography, Layout, Col, Radio, Button, Progress, Spin } from 'antd';
import Icon from '@ant-design/icons';
import { Player, BigPlayButton } from 'video-react';

import Draggable from "react-draggable";
import axios from "axios";
import io from 'socket.io-client';

import "../App.css";
import '../style/dark-theme.css';
import "antd/dist/antd.css";
import "video-react/dist/video-react.css";
import UploadBox from './UploadBox';
import Footer from './Footer';
import Header from './Header';
import VideoSettings from './VideoSettings';
import NotifUtils from "./notificationsUtils";
import withBananaContext from './withBananaContext';
import { Message } from '@wikimedia/react.i18n';
import { formatTime, decodeTime } from '../utils/time';

const { OverwriteBtnTooltipMsg, showNotificationWithIcon } = NotifUtils;
const ENV_SETTINGS = require("../env")();
// These are the API URL's
const API_URL = ENV_SETTINGS.backend_url;
const SOCKETIO_URL = ENV_SETTINGS.socket_io_url
const SOCKET_IO_PATH = ENV_SETTINGS.socket_io_path;

const { Content } = Layout;
const { Step } = Steps;

const socket = io(SOCKETIO_URL, { path: SOCKET_IO_PATH });

function getWindowDimensions() {
  const { innerWidth: width, innerHeight: height } = window;
  return {
    width,
    height,
  };
}

class Home extends Component {
  constructor(props) {
    super(props);

    this.onChange = this.onChange.bind(this);
    this.onSubmit = this.onSubmit.bind(this);
    this.handleValueChange = this.handleValueChange.bind(this);
    this.updatePlayerInfo = this.updatePlayerInfo.bind(this);
    this.onChangeCrop = this.onChangeCrop.bind(this);

    this.displayCrop = this.displayCrop.bind(this);
    this.displayTrim = this.displayTrim.bind(this);
    this.disableAudio = this.disableAudio.bind(this);
    this.displayRotate = this.displayRotate.bind(this);
    this.displayVideoSettings = this.displayVideoSettings.bind(this);

    this.handleDrag = this.handleDrag.bind(this);
    this.onDragStop = this.onDragStop.bind(this);
    this.beforeOnTapCrop = this.beforeOnTapCrop.bind(this);
    this.AfterOnTapCrop = this.AfterOnTapCrop.bind(this);
    this.checkTitleInUrl = this.checkTitleInUrl.bind(this);
    this.checkFileExist = this.checkFileExist.bind(this);
    this.goToNextStep = this.goToNextStep.bind(this);
    this.getFileNameFromPath = this.getFileNameFromPath.bind(this);

    this.rotateVideo = this.rotateVideo.bind(this);
    this.trimIntoMultipleVideos = this.trimIntoMultipleVideos.bind(this);
    this.trimIntoSingleVideo = this.trimIntoSingleVideo.bind(this);
    this.cropVideo = this.cropVideo.bind(this);
    this.UndodisableAudio = this.UndodisableAudio.bind(this);
    this.RotateValue = this.RotateValue.bind(this);

    //Implementing steps
    this.changeStep = this.changeStep.bind(this);

    this.state = {
      ...this.initalState(),
    }

  }

  initalState() {
    return {
      deltaPosition: {
        x: 0,
        y: 0
      },
      videos: [],
      trimMode: "single",
      inputVideoUrl: "",
      trims: [{ from: 0, to: 5 }],
      out_width: "",
      out_height: "",
      x_value: "",
      y_value: "",
      display: false,
      displayCrop: false,
      displayTrim: false,
      displayRotate: false,
      displayPlayer: false,
      disableAudio: false,
      user: null,
      beforeOnTapCrop: true,
      AfterOnTapCrop: false,
      upload: false,
      trimVideo: false,
      rotateVideo: false,
      cropVideo: false,
      trimIntoSingleVideo: true,
      trimIntoMultipleVideos: false,
      //loading button
      loading: false,
      displayLoadingMessage: false,
      progressPercentage: 0,
      currentTask: this.props.banana.i18n('task-processing'),
      //Slider Values,
      changeStep: 0,
      duration: 0,
      //display VideoSettings
      displayVideoSettings: false,
      displayURLBox: true,
      validateVideoURL: false,
      RotateValue: -1,
      displaynewVideoName: false,
      DisplayFailedNotification: false,
    
      uploadedFile: null,
      fileList: [],
      temporaryTrimValue: [{ from: null, to: null }]
    }
  }

  componentDidMount() {
    socket.on('reconnect', (attemptNumber) => {
      // ...
      try {
        if (localStorage.getItem('user') && JSON.parse(localStorage.getItem('user'))) {
          socket.emit('authenticate', JSON.parse(localStorage.getItem('user')));
        }
      } catch (e) {
      }
    });
    this.setState({
      width: getWindowDimensions().width
    });
    socket.on('progress:update', data => {
      console.log(data)
      const progressData = data;
      console.log('ON PROCESSS', progressData)
      const { stage, status, ...rest } = progressData;
      if (status === 'processing') {
        this.setState({
          progressPercentage: 50,
          currentTask: this.props.banana.i18n(`task-stage-${stage.replace(' ', '_')}`),
        });
      } else if (status === 'done') {
        this.previewCallback({ data: { videos: progressData.outputs } })
      }
    });

    // Check if title passed as parameter into url
    this.checkTitleInUrl();
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.state.playerSource !== prevState.playerSource && this.refs.player) {
      console.log("error: " + this.refs.player);
      this.refs.player.load();
    }
  }

  resetState = () => {
    this.setState({ ...this.initalState() });
  }

  enterLoading = () => {
    this.setState({
      loading: true,
      displayLoadingMessage: true,
      progressPercentage: 0,
      currentTask: this.props.banana.i18n('task-processing'),
    });
  };

  leaveLoading = () => {
    this.setState({
      loading: false,
      displayLoadingMessage: false,
      progressPercentage: 0,
      currentTask: this.props.banana.i18n('task-processing'),
    })
  }

  RotateValue(RotateValue) {
    RotateValue = (RotateValue + 1) % 4;
    this.setState({
      RotateValue: RotateValue
    })
  }

  changeStep = num => {
    this.setState({
      changeStep: num
    });
  };

  // Check if title passed as parameter into url
  checkTitleInUrl() {
    const search = window.location.search;
    const params = new URLSearchParams(search);
    const title = params.get('title');
    if (title) {
      var filePath = 'https://commons.wikimedia.org/wiki/File:' + title;
      this.setState({
        inputVideoUrl: filePath
      }, () => this.checkFileExist(filePath));
    }
  }

  getFileNameFromPath(filePath) {
    const splitPath = filePath.split('/');
    const length = splitPath.length;
    return splitPath[length - 1];
  }

  // Check if given file exists
  checkFileExist(filePath) {
    const fileName = this.getFileNameFromPath(filePath);
    const baseUrl = "https://commons.wikimedia.org/w/api.php?";
    const params = {
      "action": "query",
      "titles": fileName,
      "format": "json",
      "formatversion": 2,
      "origin": "*"
    }
    axios.get(baseUrl, {
      params: params
    })
      .then(response => {
        const pageObj = response.data.query.pages[0];
        if (pageObj.hasOwnProperty("missing")) {
          showNotificationWithIcon("error", this.props.banana.i18n('file-not-existing'), this.props.banana);
        }
        else {
          this.goToNextStep();
        }
      })
      .catch(error => {
        showNotificationWithIcon("error", this.props.banana.i18n('file-not-existing'), this.props.banana);
      })
  }

  // Go to step 2 directly
  goToNextStep() {
    this.updatePlayerInfo(this.state.inputVideoUrl);
    this.changeStep(1);
    this.setState({
      validateVideoURL: true,
      displayVideoSettings: true,
      upload: false,
      trimVideo: false,
      rotateVideo: false,
      cropVideo: false,
      trimIntoSingleVideo: true,
      trimIntoMultipleVideos: false,
      disableAudio: false,
      displayURLBox: false,
    });
  }

  handleValueChange(e) {
    var filePath = e.target.value;
    this.setState({
      inputVideoUrl: filePath
    });
  }

  // This updates the player src, and displays the player
  updatePlayerInfo(videoUrl) {
    const splittedUrl = videoUrl.split('/');
    const resultObj = {
      playerSource: videoUrl,
      display: true,
      displayPlayer: true,
      displayCrop: false,
      displayRotate: false
    };

    if (splittedUrl.includes('commons.wikimedia.org')) {
      axios.get(
        `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=videoinfo&titles=${splittedUrl[splittedUrl.length - 1]}&viprop=user%7Curl%7Ccanonicaltitle%7Ccomment%7Curl&origin=*`
      )
        .then(response => {
          const { pages } = response.data.query;
          if (Object.keys(pages)[0] !== '-1') {
            const { user, canonicaltitle, comment, url } = pages[Object.keys(pages)[0]].videoinfo[0];
            resultObj.playerSource = url;
            resultObj.inputVideoUrl = url;
            resultObj.videos = [{
              author: user,
              title: decodeURIComponent(canonicaltitle.slice(5)).replace(/\s/g, '_'),
              comment,
              text: ''
            }];

            this.setState(resultObj);
          }
        });
    }
    else {
      resultObj.videos = [{
        author: this.state.user === null ? '' : this.state.user.username,
        title: this.state.uploadedFile === null ? decodeURIComponent(splittedUrl[splittedUrl.length - 1]).replace(/\s/g, '_') : this.state.uploadedFile.name.replace(/\s/g, '_'),
        comment: '',
        text: ''
      }];
      this.setState(resultObj);
    }
  }

  rotateVideo() {
    this.setState({
      rotateVideo: true
    });
  }

  cropVideo() {
    this.setState({
      cropVideo: true
    });
  }

  trimIntoMultipleVideos() {
    this.setState({
      trimIntoMultipleVideos: true,
      trimIntoSingleVideo: false
    });
  }

  trimIntoSingleVideo() {
    this.setState({
      trimIntoSingleVideo: true,
      trimIntoMultipleVideos: false
    });
  }

  displayVideoSettings() {
    this.setState({
      displayVideoSettings: true
    });
  }

  displayCrop() {
    this.setState({
      displayCrop: true,
      displayTrim: false,
      displayRotate: false,
      displayPlayer: false
    }, () => {
      const self = this;
      const resizerBlock = this.dragRef;
      if (!resizerBlock) return;
      const resizers = resizerBlock.querySelectorAll('.resizer');

      const minSize = 100;
      let original_width = 0;
      let original_height = 0;
      let original_mouse_x = 0;
      let original_mouse_y = 0;
      let transformValue = [0, 0];

      let width = 0;
      let height = 0;
      let top = 0;
      let left = 0;

      function getTruePropertyValue(property) {
        return parseFloat(getComputedStyle(resizerBlock, null).getPropertyValue(property).replace('px', ''));
      }

      function getTransformValue() {
        return resizerBlock.style.transform.replace(/[^0-9\-.,]/g, '').split(',').map(Number);
      }

      function getPlayerCoords() {
        return document.getElementById('video-1').getBoundingClientRect();
      }

      resizers.forEach(resizer => {
        const resizerPosition = resizer.className.split(' ')[1];

        resizer.addEventListener('mousedown', e => {
          e.preventDefault();

          original_width = getTruePropertyValue('width');
          original_height = getTruePropertyValue('height');
          transformValue = getTransformValue();
          original_mouse_x = e.pageX;
          original_mouse_y = e.pageY;

          window.addEventListener('mousemove', resize);
          window.addEventListener('mouseup', stopResize);
        });

        resizer.addEventListener('touchstart', e => {
          e.preventDefault();

          original_width = getTruePropertyValue('width');
          original_height = getTruePropertyValue('height');
          transformValue = getTransformValue();

          // taking the first touch event and
          // ignoring touch events for other fingers
          original_mouse_x = e.changedTouches[0].pageX;
          original_mouse_y = e.changedTouches[0].pageY;

          window.addEventListener('touchmove', resize);
          window.addEventListener('touchend', stopResize);
        });

        function resize(e) {
          // check if it is a touch interface,
          // else do everything the usual way
          e = (e.changedTouches && e.changedTouches[0]) || e;
          switch (resizerPosition) {
            case 'top-center':
              top = e.pageY - original_mouse_y;
              height = original_height - (e.pageY - original_mouse_y);
              if (height > minSize && transformValue[1] + top >= 0) {
                resizerBlock.style.transform = `translate(${transformValue[0]}px, ${transformValue[1] + top}px)`;
                resizerBlock.style.height = `${height}px`;
              }
              break;
            case 'bottom-center':
              height = original_height + (e.pageY - original_mouse_y);
              if (height > minSize && transformValue[1] + height <= parseFloat(getPlayerCoords().height)) {
                resizerBlock.style.height = `${height}px`;
              }
              break;
            case 'left-center':
              left = e.pageX - original_mouse_x;
              width = original_width - (e.pageX - original_mouse_x);
              if (width > minSize && transformValue[0] + left >= 0) {
                resizerBlock.style.transform = `translate(${transformValue[0] + left}px, ${transformValue[1]}px)`;
                resizerBlock.style.width = `${width}px`;
              }
              break;
            case 'right-center':
              width = original_width + (e.pageX - original_mouse_x);
              if (width > minSize && transformValue[0] + width <= parseFloat(getPlayerCoords().width)) {
                resizerBlock.style.width = `${width}px`;
              }
              break;
            case 'top-left':
              width = original_width - (e.pageX - original_mouse_x);
              height = original_height - (e.pageY - original_mouse_y);
              if (width > minSize && transformValue[0] + (e.pageX - original_mouse_x) >= 0) {
                resizerBlock.style.width = `${width}px`;
                left = e.pageX - original_mouse_x;
              }
              if (height > minSize && transformValue[1] + (e.pageY - original_mouse_y) >= 0) {
                resizerBlock.style.height = `${height}px`;
                top = e.pageY - original_mouse_y;
              }
              resizerBlock.style.transform = `translate(${transformValue[0] + left}px, ${transformValue[1] + top}px)`;
              break;
            case 'top-right':
              width = original_width + (e.pageX - original_mouse_x);
              height = original_height - (e.pageY - original_mouse_y);
              top = e.pageY - original_mouse_y;
              if (width > minSize && transformValue[0] + width <= parseFloat(getPlayerCoords().width)) {
                resizerBlock.style.width = `${width}px`;
              }
              if (height > minSize && transformValue[1] + top >= 0) {
                resizerBlock.style.height = `${height}px`;
                resizerBlock.style.transform = `translate(${transformValue[0]}px, ${transformValue[1] + top}px)`;
              }
              break;
            case 'bottom-left':
              height = original_height + (e.pageY - original_mouse_y);
              width = original_width - (e.pageX - original_mouse_x);
              left = e.pageX - original_mouse_x;
              if (height > minSize && transformValue[1] + height <= parseFloat(getPlayerCoords().height)) {
                resizerBlock.style.height = `${height}px`;
              }
              if (width > minSize && transformValue[0] + left >= 0) {
                resizerBlock.style.width = `${width}px`;
                resizerBlock.style.transform = `translate(${transformValue[0] + left}px, ${transformValue[1]}px)`;
              }
              break;
            case 'bottom-right':
              width = original_width + (e.pageX - original_mouse_x);
              height = original_height + (e.pageY - original_mouse_y);
              if (width > minSize && transformValue[0] + width <= parseFloat(getPlayerCoords().width)) {
                resizerBlock.style.width = `${width}px`;
              }
              if (height > minSize && transformValue[1] + height <= parseFloat(getPlayerCoords().height)) {
                resizerBlock.style.height = `${height}px`;
              }
              break;
            default:
              break;
          }
        }

        function stopResize() {
          if (self.refs.player !== undefined) {
            self.onDragStop();
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('touchmove', resize);
            window.removeEventListener('mouseup', stopResize);
            window.removeEventListener('touchend', stopResize);
          }
        }
      });
    });
  }

  beforeOnTapCrop() {
    this.setState({
      beforeOnTapCrop: true
    });
  }

  AfterOnTapCrop() {
    this.setState({
      beforeOnTapCrop: false,
      AfterOnTapCrop: true
    });
  }

  displayTrim() {
    this.setState({
      displayTrim: true,
      displayPlayer: true,
      displayCrop: false,
      displayRotate: false,
      trimMode: "trim"
    });
  }

  displayRotate() {
    this.setState({
      displayRotate: true,
      displayCrop: false,
      displayTrim: false,
      displayPlayer: false,
      trimMode: "rotate"
    });
  }

  disableAudio() {
    this.setState({
      disableAudio: true
    });
  }

  UndodisableAudio() {
    this.setState({
      disableAudio: false
    });
  }

  onChangeCrop(e) {
    this.setState({
      [e.target.name]: e.target.value
    });
  }

  onChangeRadioButton = e => {
    this.setState({
      value: e.target.value
    });
  };

  // This is to add multiple "From" and "To" while trimming
  add() {
    let trims = this.state.trims;
    trims.push({ from: 0, to: 5 });
    let temporaryTrimValue = this.state.temporaryTrimValue;
    temporaryTrimValue.push({ from: null, to: null });
    this.setState({
      trims: trims,
      temporaryTrimValue: temporaryTrimValue
    });
  };

  onChange = e => {
    let trims = this.state.trims;
    const id = e.target.id;
    const index = id.match(/\d+/g).map(Number)[0];

    if (id.includes("from")) {
      trims[index].from = e.target.value;
    } else if (id.includes("to")) {
      trims[index].to = e.target.value;
    }
    this.setState({
      trims: trims
    });
  };

  handleDrag(ui) {
    const { x, y } = this.state.deltaPosition;
    this.setState({
      deltaPosition: {
        x: x + ui.deltaX,
        y: y + ui.deltaY
      }
    });
  }

  onDragStop() {
    const parentBox = this.refs.player.video.video.getBoundingClientRect();
    this.setState({
      duration: this.refs.player.video.video
        .duration
    });
    if (!this.dragRef) return;
    const dragElBox = this.dragRef.getBoundingClientRect();
    const xPercentage = ((dragElBox.x - parentBox.x) / parentBox.width * 100);
    const yPercentage = ((dragElBox.y - parentBox.y) / parentBox.height * 100);
    const widthPercentage = (dragElBox.width / parentBox.width * 100);
    const heightPercentage = (dragElBox.height / parentBox.height * 100);
    this.setState({
      x_value: xPercentage,
      y_value: yPercentage,
      out_height: heightPercentage,
      out_width: widthPercentage
    });
  }

  previewCallback(res) {
    function previewComplete(banana) {
      self.setState(previewCompleteState);
      showNotificationWithIcon("success", banana.i18n('success'), banana);
    }

    let videos = [];

    const self = this;
    const previewCompleteState = {
      videos,
      displayRotate: false,
      displayCrop: false,
      loading: false,
      currentTask: this.props.banana.i18n('task-processing'),
      displayPlayer: false,
      displayLoadingMessage: false,
      changeStep: 3,
      displayVideoSettings: false
    };

    if (!this.state.upload) {
      if (res.data.videos.length > 0) {
        res.data.videos.map((item, index) => {
          let newVideoTitle = this.state.videos[index].title.split('.');
          let oldVideoTitle = this.state.videos[index].title.split('.');
          
          newVideoTitle[0] = newVideoTitle[0].concat('_(edited)');

          if (index > 0) newVideoTitle[0] = newVideoTitle[0].concat(`(${index})`);
          newVideoTitle[1] = item.split('.')[1];
          newVideoTitle = newVideoTitle.join('.');
          
          if (index > 0) oldVideoTitle[0] = oldVideoTitle[0].concat(`(${index})`);
          oldVideoTitle[1] = item.split('.')[1];
          oldVideoTitle = oldVideoTitle.join('.');

          const currentDate = new Date();
          const currentMonth = currentDate.getMonth() + 1 < 10 ? `0${currentDate.getMonth() + 1}` : currentDate.getMonth() + 1;
          const currentDay = currentDate.getDate() < 10 ? `0${currentDate.getDate()}` : currentDate.getDate();

          const { author, comment } = this.state.videos[index];

          return videos.push({
            path: item,
            title: newVideoTitle,
            author: author,
            comment: comment,
            text: `=={{int:filedesc}}==
{{Information${comment.length > 0 ? `\n|description=${comment}` : ''}
|date=${`${currentDate.getFullYear()}-${currentMonth}-${currentDay}`}
|source={{own}}${author.length > 0 ? `\n|author=[[User:${author}|${author}]]` : ''}
}}\n
=={{int:license-header}}==
{{self|cc-by-sa-4.0}}\n
[[Category:VideoCutTool]]\n
{{Extracted from|File:${oldVideoTitle} }}`,
            selectedOptionName: 'new-file',
            displayUploadToCommons: false
          });
        });
      }
    }
    else {
      videos = this.state.videos;
    }
    previewCompleteState.videos = videos;
    return previewComplete(this.props.banana);
  }

  previewCallbackError(err) {
    console.log(err);
    const reason = err.response && err.response.text ? err.response.text : this.props.banana.i18n('error');
    showNotificationWithIcon("error", reason, this.props.banana);
    this.setState({ DisplayFailedNotification: true });
    this.leaveLoading();
  }

  // On Clicking the "Preview" button the values will submit to the back-end
  onSubmit(e) {
    e.preventDefault();
    const self = this;
    const obj = {
      inputVideoUrl: this.state.inputVideoUrl,
      trims: this.state.trims,
      out_width: this.state.out_width,
      out_height: this.state.out_height,
      x_value: this.state.x_value,
      y_value: this.state.y_value,
      trimMode: this.state.trimIntoSingleVideo ? "single" : "multiple",
      value: this.state.value,
      user: this.state.user,
      trimVideo: this.state.trimVideo,
      upload: this.state.upload,
      rotateVideo: this.state.rotateVideo,
      cropVideo: this.state.cropVideo,
      disableAudio: this.state.disableAudio,
      trimIntoMultipleVideos: this.state.trimIntoMultipleVideos,
      trimIntoSingleVideo: this.state.trimIntoSingleVideo,
      RotateValue: this.state.RotateValue,
      videos: this.state.upload
        ? this.state.videos.filter(video => video.displayUploadToCommons)
        : this.state.videos
    };

    let newVideos = this.state.videos;
    if (!this.state.upload && this.state.trims.length > 1) {
      for (let i = 0; i <= this.state.trims.length; i++) {
        newVideos.push(this.state.videos[0]);
      }
    }

    if (this.state.uploadedFile !== null) {
      let data = new FormData();
      data.append('video', this.state.uploadedFile);
      data.append('data', JSON.stringify(obj))
      this.setState({ currentTask: this.props.banana.i18n('task-uploading'), videos: newVideos });
      axios.post(`${API_URL}/video-cut-tool-back-end/send/upload`, data, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: function (progressEvent) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          self.setState({ progressPercentage: percentCompleted });
        }
      }).then(res => {
        this.setState({ loading: true })

      }).catch(err => {
        this.previewCallbackError(err);
      })
    } else {
      axios.post(`${API_URL}/video-cut-tool-back-end/send`, obj).then(res => {
        this.setState({ loading: true })
      }).catch(err => {
        this.previewCallbackError(err);
      })
    }
  }

  handleUploadChange = info => {
    let fileList = [...info.fileList];

    fileList = fileList.slice(-1);

    this.setState({ fileList });
  };

  checkVideoTitles() {
    let videoList = this.state.videos;
    return !videoList.map(video => video.title.length > 0).includes(false)
      && videoList.filter(video => video.displayUploadToCommons).length > 0
  }

  getSettings() {
    return [
      {
        icon: "sound",
        property: this.state.disableAudio,
        undoProperty: !this.state.disableAudio,
        click: () => this.disableAudio(),
        undoClick: () => this.UndodisableAudio(),
        text: this.props.banana.i18n('setting-audio'),
      },
      {
        icon:"redo",
        property: false,
        undoProperty: !this.state.rotateVideo,
        click: () => {
          this.rotateVideo();
          this.RotateValue(this.state.RotateValue);
          this.displayRotate();
        },
        undoClick: () => {
          this.setState({ rotateVideo: false });
        },
        text: this.props.banana.i18n('setting-rotate'),
      },
      {
        icon:"scissor",
        property: this.state.trimVideo,
        undoProperty: !this.state.trimVideo,
        click: () => {
          this.displayTrim();
          this.setState({
            trimVideo: true
          });
        },
        undoClick: () => this.setState({ trimVideo: false, displayTrim: false }),
        text: this.props.banana.i18n('setting-trim'),
      },
      {
        icon: "radius-setting",
        property: this.state.cropVideo,
        undoProperty: !this.state.cropVideo,
        click: () => {
          this.cropVideo();
          this.displayCrop();
        },
        undoClick: () => {
          this.setState({ cropVideo: false });
        },
        text: this.props.banana.i18n('setting-crop'),
      }
    ]
  }


  getUploadProperties = () => {
    const { uploadedFile, fileList } = this.state;
    return {
      multiple: false,
      accept: ".mp4,.webm,.mov,.flv,.ogv",
      onChange: this.handleUploadChange,
      onRemove: file => {
        this.setState({
          uploadedFile: file
        });
      },
      beforeUpload: file => {
        this.setState({
          uploadedFile: file
        });
        return false;
      },
      uploadedFile,
      fileList,
    };
  }

  renderURLBox = () => {
    if (!this.state.displayURLBox) return null;
    const uploadProperties = this.getUploadProperties();

    const inputProps = {
      placeholder: "https://commons.wikimedia.org/wiki/File:video.webm",
      ref: (ref) => this.inputVideoUrl = ref,
      name: "inputVideoUrl",
      id: "inputVideoUrl",
      value: this.state.inputVideoUrl,
      onChange: this.handleValueChange
    }

    const editButtonProps = {
      type: "primary",
      disabled: !this.state.inputVideoUrl && this.state.uploadedFile === null,
      onClick: () => {
        if (!this.state.user) return alert(this.props.banana.i18n('login-alert'));
        if (this.state.uploadedFile !== null) {
          this.updatePlayerInfo(URL.createObjectURL(this.state.uploadedFile))
          this.setState({
            validateVideoURL: true
          })
          this.changeStep(1);
          this.setState({
            displayVideoSettings: true,
            upload: false,
            trimVideo: false,
            rotateVideo: false,
            cropVideo: false,
            trimIntoSingleVideo: true,
            trimIntoMultipleVideos: false,
            disableAudio: false,
            displayURLBox: false,
          });
        } else {
          this.checkFileExist(this.state.inputVideoUrl);
        }
      },
      style: { marginTop: "12px" },
    }

    return (
      <div style={{ paddingTop: "2vh" }}>
        <UploadBox
          draggerProps={uploadProperties}
          inputProps={inputProps}
          editButtonProps={editButtonProps}
        />
      </div>)
  }

  render() {
    const dragHandlers = { onStart: this.onStart, onStop: this.onStop };
    const { uploadedFile } = this.state;
    const uploadProperties = this.getUploadProperties();

    console.log("URL: " + this.state.inputVideoUrl);

    return (
      <Layout className="layout">
        <Header
          parentUserUpdateCallback={(user) => { this.setState({user: user}); }}
          parentLanguageUpdateCallback={this.props.parentLanguageUpdateCallback}
          socket={socket} width={this.state.width}
          api_url={API_URL} />
        <form onSubmit={this.onSubmit}>
          <Content className="Content">
            <div className="row m-0">
              <div className="col-sm-12 col-md-8 p-4">
                <div>
                  <div className="docs-example" style={{ height: "100%" }}>
                    {
                      this.state.DisplayFailedNotification ? (
                        <div style={{ paddingBottom: "2rem" }}>
                          <Alert
                            message={<Message id="error" />}
                            type="error"
                            closable
                          />
                        </div>
                      ) : null
                    }
                    <div id="steps">
                      <div className="p-4">
                        <Steps current={this.state.changeStep}>
                          <Step title={<Message id="step-video-url" />} />
                          <Step title={<Message id="step-video-settings" />} />
                          <Step title={<Message id="step-result" />} />
                        </Steps>
                      </div>
                    </div>
                    {this.state.displayLoadingMessage ? (
                      <div
                        style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
                      >
                        {!this.state.upload && <Spin size="large" style={{ marginBottom: 2 }} />}
                        {/*Modify*/}
                        <p style={{ marginBottom: 0 }}>
                          <Message id="task-current" placeholders={[this.state.currentTask]} />
                        </p>
                        {this.state.upload && <Progress percent={this.state.progressPercentage} status="active" style={{ marginBottom: 10, padding: '0 5%' }} />}
                      </div>
                    ) : null}
                    {this.renderURLBox()}
                    <br />
                    {this.state.displaynewVideoName && (
                      <div>
                        {this.state.videos.length > 1 ? (
                          <>
                            <p style={{ margin: "5px 0" }}>
                              <Message id="new-video" placeholders={this.state.videos} />
                            </p>
                            <ul>
                              {this.state.videos.map(video => (
                                <li>
                                  <a href={`https://commons.wikimedia.org/wiki/File:${video.title}`} target="_blank" rel="noopener noreferrer">
                                    https://commons.wikimedia.org/wiki/File:{video.title}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                            <>
                              <p style={{ margin: "5px 0" }}>
                                <Message id="new-video" /> <a href={`https://commons.wikimedia.org/wiki/File:${this.state.videos[0].title}`} target="_blank" rel="noopener noreferrer">
                                  https://commons.wikimedia.org/wiki/File:{this.state.videos[0].title}
                                </a>
                              </p>
                            </>
                          )}
                      </div>
                    )}
                    {this.state.changeStep === 3 && this.state.videos.map(video => (
                      <div className="row" key={'preview-video-' + video.path}>
                        <div className="col-sm-12 p-2">
                          <div className="player">
                            <br />
                            <Player
                              refs={player => {
                                this.player = player;
                              }}
                              ref="player"
                              videoId="video-1"
                            >
                              <BigPlayButton position="center" />
                              <source src={`${API_URL}/${video.path}`} />
                            </Player>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Crop Video */}
                    {this.state.displayVideoSettings && !this.state.displayRotate ? (
                      <div>
                        <div
                          className="box"
                          style={{
                            height: "100%",
                            width: "100%",
                            position: "relative",
                            overflow: "hidden"
                          }}
                        >
                          {this.state.cropVideo && (
                              <Draggable
                                bounds="parent"
                                {...dragHandlers}
                                axis="both"
                                handle="#draggable-area"
                                onDrag={(e, ui) => {
                                  this.handleDrag(ui);
                                }}
                                onStop={this.onDragStop}
                              >
                                <div
                                  ref={ref => (this.dragRef = ref)}
                                  className="box"
                                  id="crop-area"
                                  onHeightReady={height =>
                                    console.log("Height: " + height)
                                  }
                                  style={{ height: "95%", width: "95%" }}
                                >
                                    <div id="draggable-area"></div>
                                    <div className="resizers">
                                      <div className="resizer top-left"></div>
                                      <div className="resizer top-center"></div>
                                      <div className="resizer top-right"></div>
                                      <div className="resizer bottom-left"></div>
                                      <div className="resizer bottom-center"></div>
                                      <div className="resizer bottom-right"></div>
                                      <div className="resizer left-center"></div>
                                      <div className="resizer right-center"></div>
                                    </div>
                                    <div className="crosshair"></div>
                                </div>
                              </Draggable>
                          )}

                            <Player
                              ref="player"
                              height="300"
                              width="300"
                              videoId="video-1"
                            >
                              <BigPlayButton position="center" />
                              <source src={this.state.playerSource} />
                            </Player>
                          </div>
                      </div>

                    ) : null}

                    {/* Rotate Video */}
                    {this.state.displayRotate ? (
                      <div>
                        <div id={"RotatePlayerValue" + this.state.RotateValue} style={{ marginTop: "8em" }} >
                          <Player ref="player" videoId="video-1" >
                            <BigPlayButton position="center" />
                            <source src={this.state.playerSource} />
                          </Player>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              {/* Video Settings */}
              {(this.state.displayVideoSettings && this.state.validateVideoURL) && (
                <div className="col-sm-12 col-md-4 p-2" style={{ position: "sticky" }}>
                  <br />
                  <div className="videoSettings">
                    <h5 style={{ textAlign: "center" }}>
                      <Message id="step-video-settings-title" />
                    </h5>
                    <VideoSettings settings={this.getSettings()} />
                    <Divider />
                    {this.state.trimVideo ? (
                      <Col>
                        <h5>
                          <Message id="video-trim-title" />
                        </h5>
                        {this.refs.player && this.state.trims.map((trim, i) => (
                          <React.Fragment key={'trim-' + i}>
                            <Slider
                              range
                              step={0.1}
                              min={0}
                              max={this.refs.player.video.video.duration}
                              value={[trim.from, trim.to]}
                              tipFormatter={formatTime}
                              onChange={obj => {
                                let trims = this.state.trims;
                                trims[i].from = obj[0];
                                trims[i].to = obj[1];
                                this.setState({
                                  trims: trims
                                });
                                if (this.unsubscribeToStateChanges) {
                                  this.unsubscribeToStateChanges();
                                }
                                this.refs.player.seek(obj[0]);
                                this.refs.player.play();
                                this.unsubscribeToStateChanges = this.refs.player.subscribeToStateChange((state) => {
                                  if (state.currentTime > obj[1]) {
                                    this.refs.player.pause();
                                  }
                                });
                              }}
                            />
                            <div className="row" key={i}>
                              <div className="col-md-6">
                                <Typography.Text
                                  strong
                                  style={{ paddingRight: "0.2rem" }}
                                >
                                  <Message id="video-trim-from" />
                                </Typography.Text>
                                <div className="form-group">
                                  <Input
                                    placeholder="hh:mm:ss"
                                    id={`trim-${i}-from`}
                                    value={this.state.temporaryTrimValue[i].from||formatTime(trim.from)}
                                    onChange={ obj => {
                                      let temporaryTrimValue = this.state.temporaryTrimValue;
                                      temporaryTrimValue[i].from = obj.target.value;
                                      if( obj.target.value === '' || /^[0-9:.]*$/.test( obj.target.value ) ){
                                        this.setState({
                                          temporaryTrimValue: temporaryTrimValue
                                        });
                                      }
                                      if ( this.timeout ) {
                                        clearTimeout( this.timeout );
                                      }
                                      this.timeout = setTimeout(() =>{
                                        let trims = this.state.trims;
                                        let temporaryTrimValue = this.state.temporaryTrimValue;
                                        let decodedTime = decodeTime( this.state.temporaryTrimValue[i].from );
                                        if ( decodedTime !== null ) {
                                          if ( decodedTime <= trims[i].to ){
                                            trims[i].from = decodedTime;
                                          } else {
                                            trims[i].from = trims[i].to;
                                            trims[i].to = decodedTime;
                                            temporaryTrimValue[i].to = null;
                                          }
                                          temporaryTrimValue[i].from = null;
                                        }
                                        this.setState({
                                          trims: trims
                                        });
                                      }, 1000);
                                    }}
                                  />
                                </div>
                              </div>
                              <div className="col-md-6">
                                <Typography.Text
                                  strong
                                  style={{ paddingRight: "0.2rem" }}
                                >
                                  <Message id="video-trim-to" />
                                </Typography.Text>
                                <div className="form-group">
                                  <Input
                                    placeholder="hh:mm:ss"
                                    id={`trim-${i}-to`}
                                    value={this.state.temporaryTrimValue[i].to||formatTime(trim.to)}
                                    onChange={ obj => {
                                      let temporaryTrimValue = this.state.temporaryTrimValue;
                                      temporaryTrimValue[i].to = obj.target.value;
                                      if( obj.target.value === '' || /^[0-9:.]*$/.test( obj.target.value ) ){
                                        this.setState({
                                          temporaryTrimValue: temporaryTrimValue
                                        });
                                      }
                                      if ( this.timeout ) {
                                        clearTimeout( this.timeout );
                                      }
                                      this.timeout = setTimeout(() => {
                                        let trims = this.state.trims;
                                        let temporaryTrimValue = this.state.temporaryTrimValue;
                                        let decodedTime = decodeTime( this.state.temporaryTrimValue[i].to );
                                        if ( decodedTime !== null ) {
                                          if ( decodedTime >= trims[i].from ){
                                            trims[i].to = decodedTime;
                                          } else {
                                            trims[i].to = trims[i].from;
                                            trims[i].from = decodedTime;
                                            temporaryTrimValue[i].from = null;
                                          }
                                          temporaryTrimValue[i].to = null;
                                        }
                                        this.setState({
                                          trims: trims
                                        });
                                      }, 1000);
                                    }}
                                  />
                                </div>
                              </div>
                              {i > 0 && (
                                <div className="col-md-4">
                                  <Button style={{ height: '100%' }} block onClick={() => {
                                    let newTrimsVar = this.state.trims.slice();
                                    newTrimsVar.splice(i, 1);
                                    this.setState({ trims: newTrimsVar });
                                  }}>
                                    <Icon type="close" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </React.Fragment>
                        ))}
                        <Button
                          type="primary"
                          onClick={() => {
                            this.add();
                          }}
                          style={{ width: "100%", margin: "1rem 0" }}
                        >
                          <Icon type="plus" /> <Message id="video-trim-more" />
                        </Button>
                        <br />
                        {this.state.trims.length > 1 && (
                          <div className="row p-3">
                            <div className="col-sm-6">
                              <Radio
                                checked={this.state.trimIntoSingleVideo}
                                onClick={this.trimIntoSingleVideo}
                              >
                                <Message id="video-trim-more-concatenate" />
                              </Radio>
                            </div>
                            <div className="col-sm-6">
                              <Radio
                                checked={this.state.trimIntoMultipleVideos}
                                onClick={this.trimIntoMultipleVideos}
                              >
                                <Message id="video-trim-more-multiple" />
                              </Radio>
                            </div>
                          </div>
                        )}
                      </Col>
                    ) : null}

                    <h5 style={{ textAlign: "center" }}>
                      <Message id="preview-title" />
                    </h5>
                    <Col style={{ textAlign: "center" }}>
                      <Button
                        type="primary"
                        onClick={e => {
                          if (this.state.user) {

                            this.enterLoading();
                            this.onSubmit(e);
                            showNotificationWithIcon("info", this.props.banana.i18n('notifications-wait'), this.props.banana);
                            this.changeStep(2);
                          } else {
                            alert(this.props.banana.i18n('login-alert-preview'));
                          }
                        }}
                        name="rotate"
                        style={{
                          height: "50px"
                        }}
                        disabled={!this.state.cropVideo && !this.state.rotateVideo && !this.state.trimVideo && !this.state.disableAudio}
                        shape="round"
                        loading={this.state.loading}
                      >
                        <Icon type="play-circle" /> <Message id="preview-text" />
                      </Button>
                    </Col>
                  </div>
                </div>
              )}
              {this.state.changeStep === 3 && (
                <div className="col-sm-12 col-md-4">
                  <>
                    <h5 style={{ textAlign: "center" }}>
                      <Message id="step-result-title" />
                    </h5>
                    {this.state.videos.map((video, index, videoArr) => (
                      <div key={'option-' + video.path}>
                        <div id={video.path.split('/').pop().split('.')[0]}>
                          <h6 style={{ textAlign: 'center' }}>{video.title}</h6>
                          <div className="button-columns row-on-mobile">
                            <div className="row">
                              <div className="col-sm-6 col-md-6 py-1">
                                <Button block type="primary">
                                  <a href={`${API_URL}/download/${video.path}`}>
                                    <Message id="step-result-choice-download" />
                                  </a>
                                </Button>
                              </div>
                              <div className="col-sm-6 col-md-6 py-1">
                                <Button
                                  block
                                  type="primary"
                                  onClick={() => {
                                    const newVideoList = videoArr;
                                    newVideoList[index] = {
                                      ...newVideoList[index],
                                      displayUploadToCommons: !newVideoList[index].displayUploadToCommons
                                    };
                                    this.setState({ videos: newVideoList });
                                  }}
                                >
                                  <Message id="step-result-choice-upload" /> <Icon type={videoArr[index].displayUploadToCommons ? "up" : "down"} />
                                </Button>
                              </div>
                            </div>
                            {videoArr[index].displayUploadToCommons ? (
                              <>
                                <Divider style={{ margin: '15px 0' }} />
                                <div className="displayUploadToCommons">
                                  <h6>
                                    <Message id="upload-action-title" />
                                  </h6>
                                  <Radio.Group
                                    defaultValue="new-file"
                                    value={videoArr[index].selectedOptionName}
                                    onChange={e => {
                                      const newVideoList = videoArr;
                                      newVideoList[index] = {
                                        ...newVideoList[index],
                                        selectedOptionName: e.target.value
                                      };
                                      this.setState({ videos: newVideoList });
                                    }}
                                  >
                                    {!this.state.uploadedFile ? (
                                      <Radio.Button value="overwrite" onChange={() => {
                                        const newVideoList = videoArr;

                                        let newTitle = newVideoList[index].title.split('.');
                                        newTitle[0] = newTitle[0].split('_').slice(0, -1).join('_');
                                        newTitle = newTitle.join('.');

                                        newVideoList[index] = {
                                          ...newVideoList[index],
                                          title: newTitle
                                        };
                                      }}>
                                        <Message id="upload-action-overwrite" />
                                      </Radio.Button>
                                    ) : (
                                        <Tooltip title={OverwriteBtnTooltipMsg(this.state, this.props.banana)}>
                                          <Radio.Button value="overwrite" disabled>
                                            <Message id="upload-action-overwrite" />
                                          </Radio.Button>
                                        </Tooltip>
                                      )}
                                    <Radio.Button value="new-file" onChange={() => {
                                      const newVideoList = videoArr;

                                      let newTitle = newVideoList[index].title.split('.');
                                      newTitle[0] = newTitle[0].concat(`_(edited)${index > 0 ? `(${index})` : ''}`);
                                      newTitle = newTitle.join('.');

                                      newVideoList[index] = {
                                        ...newVideoList[index],
                                        title: newTitle
                                      };
                                    }}>
                                      <Message id="upload-action-new-file" />
                                    </Radio.Button>
                                  </Radio.Group>

                                  {videoArr[index].selectedOptionName === 'new-file' && (
                                    <>
                                      <h6 style={{ marginTop: 10 }}>
                                        <Message id="upload-action-new-file-title" />
                                      </h6>
                                      <Input
                                        placeholder="myNewVideo.webm"
                                        ref="title"
                                        name="title"
                                        id="title"
                                        value={videoArr[index].title}
                                        onChange={e => {
                                          const newVideoList = videoArr;
                                          newVideoList[index] = {
                                            ...newVideoList[index],
                                            title: e.target.value
                                          };
                                          this.setState({ videos: newVideoList });
                                        }}
                                        required={true} />
                                    </>
                                  )}

                                  <h6 style={{ marginTop: 10 }}>
                                    <Message id="upload-comment" />
                                  </h6>
                                  <Input.TextArea
                                    name="comment"
                                    id="comment"
                                    value={videoArr[index].comment}
                                    onChange={e => {
                                      const newVideoList = videoArr;
                                      newVideoList[index] = {
                                        ...newVideoList[index],
                                        comment: e.target.value
                                      };
                                      this.setState({ videos: newVideoList });
                                    }} />

                                  <h6 style={{ marginTop: 10 }}>
                                    <Message id="upload-text" />
                                  </h6>
                                  <Input.TextArea
                                    style={{ height: "350px" }}
                                    name="text"
                                    id="text"
                                    value={videoArr[index].text}
                                    onChange={e => {
                                      const newVideoList = videoArr;
                                      newVideoList[index] = {
                                        ...newVideoList[index],
                                        text: e.target.value
                                      };
                                      this.setState({ videos: newVideoList });
                                    }} />
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {(this.state.videos.length > 1 && index < this.state.videos.length - 1) && <Divider />}
                      </div>
                    ))}
                    {this.checkVideoTitles() && (
                      <div className="upload-button" style={{ marginTop: 10 }}>
                        {this.state.user ? (
                          <Button
                            type="primary"
                            onClick={e => {
                              this.setState({ upload: true, displayLoadingMessage: true, displaynewVideoName: true, loading: true, currentTask: this.context('task-uploading-wikimedia-commons'), progressPercentage: 0 }, () => {
                                this.onSubmit(e);
                              });
                              setTimeout(() => this.setState({currentTask: this.props.banana.i18n('task-uploaded-wikimedia-commons'), loading: false,  displayLoadingMessage: false  }), 10000);
                            }}
                            
                            loading={this.state.loading}
                            block
                          >
                            <Icon type="upload" /> <Message id="upload-button" />
                            </Button>
                        ) : (
                            <Tooltip
                              placement="topLeft"
                              title={<Message id="login-alert-upload" />}
                            >
                              <Button
                                type="primary"
                                onClick={() => showNotificationWithIcon("info", this.props.banana.i18n('notifications-wait'), this.props.banana)}
                                disabled
                                block
                              >
                                <Icon type="upload" /> <Message id="upload-button" />
                              </Button>
                            </Tooltip>
                          )}
                      </div>
                    )}
                  </>
                </div>
              )}
            </div>
            <br />
          </Content>
        </form>
     <Footer />
      </Layout >
        );
  }
}

export default withBananaContext(Home);
