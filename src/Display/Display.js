import React, { Component } from 'react';
import io from 'socket.io-client';
import logo from '../Assets/cfwhite.png';
import '../App.css';
import PostIt from './PostIt';
import Pointer from './Pointer';
import Radial from './Radial';
import Container from "./Container";

const getText = async () => fetch('/postit.json', {
  method: 'GET',
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
}).then((data) => data.json())
  .then((object) => object)
  .catch((err) => Promise.reject(err));

class Display extends Component {
  constructor(props) {
    super(props);

    this.state = {
      containers: [],
      cursors: {},
      keyChecked: false,
      qrPath: '/qr',
      colors: {
        red: false, yellow: false, purple: false, pink: false,
      },
      //socket: null,
    };
  }

  async componentDidMount() {
    const { match: { params: { key } } } = this.props;
    await this.checkKey(key);
    const { keyChecked, colors } = this.state;
    if (keyChecked) {
      // load from back
      const { containers } = this.state;
      const postits = await getText();
      postits.text.forEach(({ content }) => { containers.push(content); });
      this.setState({ containers });

      // socket
      const socket = io();
      this.socket = socket;

      socket.emit('display');

      socket.on('client_list', (clients) => { // refresh cursors on page reloads
        const { cursors } = this.state;
        clients.forEach((client) => {
          if (client.clientId) {
            const color = this.pickColor();
            cursors[client.clientKey] = {
              x: 0, y: 0, color, showRadial: false,
            };
          }
        });
        this.setState({
          cursors,
        });
      });

      socket.on('move', (data) => { //  to move cursor
        if (data.length === 3) {
          this.moveCursor(data);
        }
      });

      socket.on('dir', (data) => { //  to move cursor
        if (data.length === 2) {
          this.selectDir(data);
        }
      });

      socket.on('display_cursor', (senderKey) => { //  to display cursor on user connection
        const { cursors } = this.state;
        if (senderKey != null) {
          const color = this.pickColor();
          cursors[senderKey] = {
            x: 0, y: 0, color, showRadial: false,
          };
          this.setState({
            cursors,
          });

          // Envoi de la couleur au mobile pour set le background
          socket.emit('set_color', { client: senderKey, color });
        }
        console.log(cursor);
      });

      socket.on('disconnect_user', (senderKey) => { //  removes cursor when user disconnects
        const { cursors } = this.state;
        if (cursors[senderKey]) {
          colors[cursors[senderKey].color] = false;
          delete cursors[senderKey];
          this.setState({ cursors });
        }
      });

      socket.on('reload_qr', () => { //  reload qr on user connection
        let { qrPath } = this.state;
        qrPath += `?${Date.now()}`;
        this.setState({
          qrPath,
        });
      });

      socket.on('posting', async (content) => {
        containers.push(content); //   front
        await this.postText(content); //  back
        this.setState({
          containers,
        });
      });

      socket.on('remote_click', (data) => {
        const { cursors } = this.state;
        const { x, y } = cursors[data.clientKey];
        const {
          left, right, top, bottom,
        } = document.getElementById('post').getBoundingClientRect();
        if (x > left && x < right && y > top && y < bottom) {
          socket.emit('start_posting', data.clientId);
        }
      });

      socket.on('remote_long_press', (data) => {
        const { cursors } = this.state;
        if (data.clientKey != null) {
          cursors[data.clientKey].showRadial = true;
          this.setState({
            cursors,
          });
        }
      });

      socket.on('remote_close_radial', (data) => {
        console.log('remote close radial');
        if (data.clientKey != null) {
          this.closeRadial(data.clientKey);
        }
      });

      socket.on('remote_selected_post_type', (data) => {
        const { cursors } = this.state;
        if (data.clientKey != null) {
          socket.emit('start_posting', data.clientId);
          cursors[data.clientKey].showRadial = false;
          this.setState({
            cursors,
          });
        }
      });
    }
  }

  closeRadial(clientId) {
    const { cursors } = this.state;
    console.log('close radial', cursors[clientId]);
    cursors[clientId].showRadial = false;
    this.setState({
      cursors,
    });
  }

  pickColor() { // définir une couleur pour l'utilisateur qui dure jusqu'à ce qu'il se déconnecte
    const { colors } = this.state;
    const colorsEntries = Object.entries(colors); // [['red',false],...,['purple',false]]
    for (let i = 0, len = colors.length; i < len; i += 1) {
      if (colorsEntries[i][1] === false) {
        colors[colorsEntries[i][0]] = true;
        return colorsEntries[i][0];
      }
    }
    return 'red'; // par défaut
  }

  moveCursor(data) {
    const displacement = data[1] * 0.2;
    const key = data[2];
    const dx = displacement * Math.cos(data[0]);
    const dy = -displacement * Math.sin(data[0]);
    const { cursors } = this.state;
    let { x, y } = cursors[key];

    if (key !== null) {
      x += dx;
      y += dy;
    }
    const {
      left, right, top, bottom,
    } = document.getElementById('root').getBoundingClientRect();
    if (x < left || x > right) {
      x -= dx;
    }
    if (y < top || y > bottom) {
      y -= dy;
    }
    cursors[key].x = x;
    cursors[key].y = y;
    this.setState({
      cursors,
    });
  }

  // TODO: lint
  selectDir(data) {
    const menu = document.querySelector(`#radial_${data[1]}`);
    if (menu !== null) {
      menu.querySelector(`.${data[0]}`).style.backgroundColor = 'white';
      menu.querySelectorAll(`div:not(.${data[0]})`).forEach((el) => {
        el.style.backgroundColor = 'grey';
      });
    }
  }

  postText(content) {
    const { containers } = this.state;
    return fetch('/postit.json', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id: containers.length, content }),
    });
  }


  async checkKey(key) {
    return fetch(`/display/${key}`)

      .then((resp) => resp.text()
        .then((txt) => {
          if (txt === 'ok') {
            this.setState({ keyChecked: true });
          } else {
            this.setState({ keyChecked: false });
          }
        })
        .catch((error) => {
          this.setState({ keyChecked: false });
          return Promise.reject(Error(error.message));
        }));
  }

  render() {
    const {
      containers, cursors, keyChecked, qrPath,
    } = this.state;
    const containersoRender = texts.map((text, index) => <PostIt id={`postit n ${index}`} text={text} />);
    const cursorsEntries = Object.entries(cursors);
    const cursorsToRender = cursorsEntries.map(
    // console.log(Object.entries(cursor));
    const _containers= containers.map((content, index) => (<Container id={`postit n ${index}`} content={content} x={Math.random()*90+'%'} y={Math.random()*75+'%'} />));
    const cursors = Object.entries(cursor).map(
      ([key, object]) => (
        <Pointer
          key={key}
          id={key}
          color={object.color}
          x={object.x}
          y={object.y}
        />
      ),
    );
    const radialsToRender = cursorsEntries.length ? cursorsEntries.reduce((result, cursor) => {
      if (cursor[1].showRadial) {
        result.push(
          <Radial
            socket={this.socket}
            key={cursor[0]}
            id={cursor[0]}
            color={cursor[1].color}
            x={cursor[1].x}
            y={cursor[1].y}
          />,
        );
      }
      return result;
    }, []) : '';
    return (
      keyChecked
        ? (
          <div className="Display">
            <header>
              <img src={logo} className="Display-logo" alt="logo" />
              <div id="post" className="post">Poster</div>
            </header>
            {postitsToRender}
            {cursorsToRender}
            {radialsToRender}
            <footer>
              <img src={qrPath} alt="" className="qr" />
            </footer>
          </div>
        ) : (
          <div className="Display" />
        )
    );
  }
}

export default Display;
