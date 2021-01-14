/* eslint-disable no-underscore-dangle */
const express = require('express');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const Display = require('../models/display');
const Content = require('../models/content');

const app = express.Router();

const expirationTest = (post_lifetime, post_date) => {
  const moment_post = moment(post_date);
  moment_post.add(post_lifetime, 'm');
  return moment().isBefore(moment_post); // return true if post expired
};

app.get('/display/:key', (req, res) => {
  Display.findOne({ token: req.params.key }, (err, display) => {
    if (err) res.send('ko');
    else res.send('ok');
  });
});

app.get('/content/:key', (req, res) => {
  Display.findOne({ token: req.params.key }, (err, display) => {
    if (err) res.send(JSON.stringify([]));
    else {
      Content.find({ display: display._id }, (err2, contents) => {
        if (err2) res.send(JSON.stringify([]));
        const retour = [];

        for (let i = 0; i < contents.length; i += 1) {
          if (expirationTest(contents[i].lifetime, contents[i].createdOn)) {
            retour.push({
              id: contents[i]._id,
              contentType: contents[i].type,
              content: contents[i].payload,
              x: contents[i].position.x,
              y: contents[i].position.y,
              lifetime: contents[i].lifetime,
            });
          } else {
            Content.deleteOne({ _id: contents[i]._id }, (err3, result) => {
              if (err3) {
                res.send(err3);
              } else {
                console.log(`Object with id ${contents[i]._id} deleted from database`);
              }
            });
          }
        }
        res.send(JSON.stringify(retour));
      });
    }
  });
});

app.post('/content/:key', (req, res) => {
  Display.findOne({ token: req.params.key }, async (err, display) => {
    if (err) res.send('fail');
    else {
      const newContent = new Content({
        type: req.body.contentType,
        payload: req.body.content,
        position: {
          x: req.body.x,
          y: req.body.y,
        },
        display: display._id,
        lifetime: req.body.lifetime || 60, //default lifetime is 60 minutes
      });
      const id_content = await newContent.save();
      res.json({ id_content: id_content._id });
    }
  });
});

app.put('/content/:key', (req, res) => {
  Content.findOne({ _id: req.params.key }, (err, content) => {
    if (err) res.send('fail');
    else {
      content.position.x = req.body.x;
      content.position.y = req.body.y;
      content.position.z = req.body.z;
      content.save();
      res.send('ok');
    }
  });
})

app.get('/postit.json', (req, res) => {
  res.sendFile(path.resolve(`${__dirname}/../postit.json`));
});

app.post('/postit.json', (req, res) => {
  fs.readFile(path.resolve(`${__dirname}/../postit.json`), 'utf8', (err, data) => {
    if (err) {
      console.log(err);
      res.send(err);
    } else {
      const obj = JSON.parse(data);
      obj.push(req.body);
      const json = JSON.stringify(obj);
      fs.writeFile(
        path.resolve(`${__dirname}/../postit.json`),
        json,
        'utf8',
        (error) => { if (error) { res.send('Error!'); } else { res.send('Post-it added!'); } },
      ); // write it back
    }
  });
});

app.put('/postit.json', (req, res) => {
  fs.readFile(path.resolve(`${__dirname}/../postit.json`), 'utf8', (err, data) => {
    if (err) {
      console.log(err);
      res.send(err);
    } else {
      const obj = JSON.parse(data);
      const newPostIt = req.body;
      const newObj = obj.filter((postIt) => postIt.id !== newPostIt.id);
      newObj.push(newPostIt);
      const json = JSON.stringify(newObj);
      fs.writeFile(
        path.resolve(`${__dirname}/../postit.json`),
        json,
        'utf8',
        (error) => { if (error) { res.send('Error!'); } else { res.send('Post-it updated!'); } },
      );
    }
  });
});

app.put('/all/postit.json', (req, res) => {
  console.log('AAAAAAAAAAAAAAAA');
  const json = JSON.stringify(req.body);
  fs.writeFile(
    path.resolve(`${__dirname}/../postit.json`),
    json,
    'utf8',
    (error) => { if (error) { res.send('Error!'); } else { res.send('Post-it updated!'); } },
  );
});

app.get('/qr', (req, res) => {
  res.sendFile(path.resolve(`${__dirname}/../qr.png`));
});

module.exports = {
  app,
  expirationTest,
};
