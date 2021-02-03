import React, { Component } from 'react';
import PropTypes from 'prop-types';
import ReactNipple from 'react-nipple';
import io from 'socket.io-client';
import TimePicker from 'react-time-picker';
import Popup from './PopUp';
import logo from '../Assets/logomobile.png';
import help from '../Assets/helpLogo.png'
import '../App.css';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import CancelPresentationTwoToneIcon from '@material-ui/icons/CancelPresentationTwoTone';


const defaultLifetime = '01:00';

class Mobile extends Component {
  constructor(props) {
    super(props);
    console.log("Mobile constructor :",this);
    this.state = {
      socket: null,
      distance: 0,
      key: null,
      keyChecked: false,
      backgroundColor: 'inherit',
      timer: null,
      radian: 0,
      longPressTimer: null,
      mode: 'dynamic',
      input: false,
      file: null,
      lifetime: defaultLifetime,
      showPopup: false,
      showEditable: false,
      editablePostContent: null,
      editablePostLifetime: null,
      editing: false,
      textAreaValue : '',
    };
    this.postType = null;
    this.longPressed = false;
    this.radialOption = '';
    this.threshold = 20;

    this.handleMove = this.handleMove.bind(this);
    this.handleTouchStart = this.handleTouchStart.bind(this);
    this.handleTouchEnd = this.handleTouchEnd.bind(this);
    this.onFileChange = this.onFileChange.bind(this);
    this.handlePost = this.handlePost.bind(this);
    this.handleCancel = this.handleCancel.bind(this);
    this.handleEnterKey = this.handleEnterKey.bind(this);
    this.checkKey = this.checkKey.bind(this);
    this.setLifetime = this.setLifetime.bind(this);
    this.togglePopup = this.togglePopup.bind(this);
    this.handleEditClick = this.handleEditClick.bind(this);
    this.capitalizeFirstLetter = this.capitalizeFirstLetter.bind(this);
    this.handleOnChangeTextArea = this.handleOnChangeTextArea.bind(this);
  }

  async componentDidMount() {
    const { match } = this.props;
    const { params: { key } } = match;
    await this.checkKey(key);
    const { keyChecked } = this.state;
    if (keyChecked) {
      this.setState({
        key,
      });
      const socket = io();

      socket.on('radial_open', () => {
        this.setState({ mode: 'static' });
        this.longPressed = true;
      });

      socket.on('dragging_container', () => {
        this.longPressed = true;
      });

      socket.on('set_color', (data) => {
        this.setState({
          backgroundColor: data,
        });
      });

      socket.on('disconnect', () => {
        this.setState({
          socket: null,
        });
      });

      socket.on('post_is_editable', (data) => {
        this.setState({showEditable:true, editablePostContent: data.postContent, editablePostLifetime : data.postLifetime});
        this.postType = this.capitalizeFirstLetter(data.postType);
      });

      socket.on('post_is_not_editable', (data) => {
        this.setState({showEditable:false, editablePostContent: null, editablePostLifetime : null});
        this.postType = null;
      });


      this.setState({
        socket,
      });
      socket.emit('store_client_info', { clientKey: key });
      socket.emit('cursor', { clientKey: key });
    }
  }

  capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
  }

  handleMove(_, data) {
    const { distance, angle: { radian, degree } } = data;
    this.setState({
      radian,
      distance,
      degree,
    });
  }

  handleRadialOptionChange(angle) {
    const { socket, key, distance } = this.state;
    let element;
    if (distance > this.threshold) {
      switch (true) {
        case angle >= 0 && angle < 90:
          element = 'Image';
          break;
        case angle >= 90 && angle < 180:
          element = 'Text';
          break;
        case angle >= 180 && angle < 270:
          element = 'Video';
          break;
        case angle >= 270 && angle < 360:
          element = 'Credits';
          break;
        default:
          element = 'None';
          break;
      }
    } else {
      element = 'None';
    }
    this.postType = element;
    if (this.radialOption !== element) {
      socket.emit('dir', [element, key]);
      this.radialOption = element;
    }
  }

  handleTouchStart(e) {
    const { socket, key } = this.state;
    // socket.emit('debug', 'touch start');
    if (socket && !this.longPressed) {
      socket.emit('pressing', { clientKey: key, clientId: socket.id });
    }
    this.createMoveInterval();
    const longPressTimer = setTimeout(() => this.handleLongPress(e), 1000);
    this.setState({
      longPressTimer,
    });
  }

  handleLongPress(e) {
    const {
      socket, key, distance, longPressTimer,
    } = this.state;
    if (socket && distance <= this.threshold) {
      // socket.emit('debug', 'long press');
      e.preventDefault();
      clearTimeout(longPressTimer);
      // window.navigator.vibrate(200);
      socket.emit('long_press', { clientKey: key, clientId: socket.id });
    }
  }

  handleTouchEnd() {
    const {
      socket, distance, key, longPressTimer, timer,
    } = this.state;
    clearInterval(timer);
    // socket.emit('debug', 'touch end');
    if (socket) {
      socket.emit('stop_pressing', { clientKey: key, clientId: socket.id });
      if (!this.longPressed && distance === 0) {
        socket.emit('click', { clientKey: key, clientId: socket.id });
      } else if (this.longPressed) {
        if (distance <= this.threshold) {
          // socket.emit('debug', 'close radial');
          socket.emit('close_radial', { clientKey: key, clientId: socket.id });
        } else if (this.postType !== 'Credits') {
          this.setState({ input: true });
          socket.emit('selected_post_type', { clientKey: key, clientId: socket.id });
        } else {
          socket.emit('post_credits', { clientKey: key, clientId: socket.id });
          this.postType = null;
        }
        this.setState({ mode: 'dynamic' });
      }
    }
    this.setState({
      distance: 0,
      timer,
    });
    if (this.longPressed) {
      this.longPressed = false;
    }
    clearTimeout(longPressTimer);
  }

  handlePost(event) {
    event.preventDefault();
    const { socket, key, file } = this.state;
    event.stopPropagation();
    const { postType } = this;
    // const input = document.getElementById(`${postType.toLowerCase()}Input`);
    const { lifetime } = this.state;
    switch (this.postType) {
      case 'Text':
        console.log(`Lifetime : ${lifetime}`);
        if (this.state.textAreaValue !== '') {
          const lifetimeHours = Number(lifetime.split(':')[0]);
          const lifetimeInMinutes = Number(lifetime.split(':')[1]) + 60 * lifetimeHours;
          console.log('lifetime in minutes', lifetimeInMinutes);
          socket.emit('posting', {
            contentType: 'TEXT', content: this.state.textAreaValue, clientKey: key, lifetime: lifetimeInMinutes,
          });
          this.setState({ lifetime: defaultLifetime, textAreaValue: '' });
        }
        // input.value = '';
        break;
      case 'Video':
      case 'Image':
        if (file) {
          const lifetimeHours = Number(lifetime.split(':')[0]);
          const lifetimeInMinutes = Number(lifetime.split(':')[1]) + 60 * lifetimeHours;
          console.log('lifetime in minutes', lifetimeInMinutes);
          // socket.emit('debug', `file: ${file.name}`);
          const formData = new FormData();
          formData.append('file', file);
          fetch(`/storage/${key}`, {
            method: 'POST',
            body: formData,
          })
            // .then(this.handleErrors)
            .then((response) => response.text())
            .then((data) => {
              socket.emit('posting', { contentType: postType.toUpperCase(), content: data, clientKey: key, lifetime: lifetimeInMinutes });
            })
            .catch((err) => socket.emit('debug', `err: ${err}`));
          this.setState({ lifetime: defaultLifetime });
        } else {
          socket.emit('debug', 'no file');
        }
        break;
      default:
        break;
    }
    this.setState({ input: false });
    this.postType = null;
  }

  handleCancel(event) {
    const { socket, key } = this.state;
    event.stopPropagation();
    const input = document.getElementById(`${this.postType.toLowerCase()}Input`);
    input.value = '';
    this.setState({ file: null, input: false });
    this.postType = null;
    if (socket) {
      socket.emit('cancel', { clientKey: key, clientId: socket.id });
    }
  }

  handleEnterKey(event) {
    if (event.keyCode === 13) { this.handlePost(event); }
  }

  onFileChange(e) {
    this.setState({ file: e.target.files[0] });
  }

  setLifetime(lifetime) {
    this.setState({ lifetime });
  }

  createMoveInterval() {
    const { socket, key } = this.state;
    let { timer } = this.state;
    clearInterval(timer);
    timer = setInterval(() => {
      const { distance, radian, degree } = this.state;
      if (socket) {
        if (!this.longPressed) {
          socket.emit('move', [radian, distance, key]);
        } else {
          this.handleRadialOptionChange(degree);
        }
      }
    }, 50);

    this.setState({ timer });
  }

  checkKey(key) {
    return fetch(`/mobile/${key}`)
      .then((resp) => resp.text()
        .then((txt) => {
          if (txt === 'ok') {
            this.setState({ keyChecked: true });
          } else {
            this.setState({ keyChecked: false });
          }
        })
        .catch(() => {
          this.setState({ keyChecked: false });
        }));
  }

  handleEditClick() {
    this.setState({ showEditable: false, editing: true});
  }

  // displayHelp() {
  //   alert(`Utilise ton smartphone pour déplacer le curseur à l\'écran. Appui long pour ajouter un élément.\nPlus d\'info sur ${<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />}`);
  // }

  togglePopup(e) {
    e.preventDefault();
    this.setState((prevState) => ({
      ...prevState,
      showPopup: !prevState.showPopup,
    }));
  }

  handleOnChangeTextArea(event) {
    console.log('(handleOnChangeTextArea) Changing', event.target.value)
      this.setState({textAreaValue: event.target.value});
  }


  render() {
    const {
      keyChecked, mode, backgroundColor, input, editing,
    } = this.state;

    const styleType = (inputType) => ({
      display: (input || editing) && this.postType === inputType ? 'flex' : 'none',
      'flex-direction': 'column',
      'flex-wrap': 'wrap',
      'justify-content': 'space-around',
      'align-content': 'space-around'
    })
    const styleIcon = {
      marginLeft: '10px',
      width: 36,
      height: 36,
    };

    return (
      keyChecked
        ? (
          <div className="Mobile" onTouchStart={!input ? this.handleTouchStart : false} onTouchEnd={!input ? this.handleTouchEnd : false} style={{ backgroundColor }}>
            <header>
              <img src={logo} className="Mobile-logo" alt="logo" />
              <img src={help} className="helpButton" alt="help" onClick={this.togglePopup} />
              {this.state.showPopup
                ?
                (
                  <Popup
                    text='Comment utliser la borne ?'
                    closePopup={this.togglePopup}
                  />
                )
                : null
              }
            </header>

            <div>
              {this.state.showEditable
                ? <Button onClick={this.handleEditClick}>
                Edit
                </Button>
                : null
              }
            </div>

            <div style={styleType('Text')}>
              <div style={{ display: 'flex', 'flex-wrap': 'wrap', 'justify-content': 'space-around', 'align-items': 'center', marginTop: '20px', width: '100%' }}>
                <div>
                  <textarea id="textInput" value={this.state.textAreaValue}
                  onchange={this.handleOnChangeTextArea} onKeyUp={this.handleEnterKey} maxLength="130" cols="25" rows="3" />
                </div>
                <div>
                  <p style={{ color: 'black', margin: 0 }}>
                    Durée de vie
                    </p>
                  <form noValidate>
                    <TextField
                      style={{ width: '120px' }}
                      id="time"
                      type="time"
                      variant="outlined"
                      value={editing ? this.state.editablePostLifetime : this.state.lifetime}
                      inputlabelprops={{
                        shrink: true,
                      }}
                      inputprops={{
                        step: 60, // 1 min
                      }}
                      onChange={(event) => this.setLifetime(event.target.value)}
                    />
                  </form>
                </div>
              </div>
              <div style={{ display: 'flex', 'flex-wrap': 'wrap', 'justify-content': 'center', marginTop: '20px', width: '100%' }}>
                <Button variant="contained" style={{ marginRight: '10px' }} startIcon={<CloudUploadIcon />} onClick={this.handlePost}>Poster</Button>
                <CancelPresentationTwoToneIcon style={styleIcon} onClick={this.handleCancel} />
              </div>
            </div>

            <div style={styleType('Image')}>
              <div style={{ display: 'flex', 'flex-wrap': 'wrap', 'justify-content': 'space-around', 'align-items': 'center', marginTop: '20px', width: '100%' }}>
                <div>
                  <input id="imageInput" type="file" accept="image/*" onChange={this.onFileChange} />
                </div>
                <div>
                  <p style={{ color: 'black', margin: 0 }}>
                    Durée de vie
                    </p>
                  <form noValidate>
                    <TextField
                      style={{ width: '120px' }}
                      id="time"
                      type="time"
                      variant="outlined"
                      value={this.state.lifetime}
                      inputlabelprops={{
                        shrink: true,
                      }}
                      inputprops={{
                        step: 60, // 1 min
                      }}
                      onChange={(event) => this.setLifetime(event.target.value)}
                    />
                  </form>
                </div>
              </div>
              <div style={{ display: 'flex', 'flex-wrap': 'wrap', 'justify-content': 'center', marginTop: '20px', width: '100%' }}>
                <Button variant="contained" style={{ marginRight: '10px' }} startIcon={<CloudUploadIcon />} onClick={this.handlePost}>Poster</Button>
                <CancelPresentationTwoToneIcon style={styleIcon} onClick={this.handleCancel} />
              </div>
            </div>

            <div style={styleType('Video')}>
              <div style={{ display: 'flex', 'flex-wrap': 'wrap', 'justify-content': 'space-around', 'align-items': 'center', marginTop: '20px', width: '100%' }}>
                <div>
                  <input id="videoInput" type="file" accept="video/*" onChange={this.onFileChange} />
                </div>
                <div>
                  <p style={{ color: 'black', margin: 0 }}>
                    Durée de vie
                    </p>
                  <form noValidate>
                    <TextField
                      style={{ width: '120px' }}
                      id="time"
                      type="time"
                      variant="outlined"
                      value={this.state.lifetime}
                      inputlabelprops={{
                        shrink: true,
                      }}
                      inputprops={{
                        step: 60, // 1 min
                      }}
                      onChange={(event) => this.setLifetime(event.target.value)}
                    />
                  </form>
                </div>
              </div>
              <div style={{ display: 'flex', 'flex-wrap': 'wrap', 'justify-content': 'center', marginTop: '20px', width: '100%' }}>
                <Button variant="contained" style={{ marginRight: '10px' }} startIcon={<CloudUploadIcon />} onClick={this.handlePost}>Poster</Button>
                <CancelPresentationTwoToneIcon style={styleIcon} onClick={this.handleCancel} />
              </div>
            </div>

            {!input
              && (
                <ReactNipple
                  option={{ mode, threshold: this.threshold }}
                  style={{
                    flex: '1 1 auto',
                    position: 'relative',
                  }}
                  onMove={this.handleMove}
                />
              )}
          </div>
        ) : (
          <div className="Display" />
        )
    );
  }
}

Mobile.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      key: PropTypes.string,
    }),
  }),
};

Mobile.defaultProps = {
  match: {
    params: {
      key: 'fire',
    },
  },
};

export default Mobile;
