require('dotenv').config();
const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const cors = require('cors')
const mongoose = require('mongoose')
const {cloneDeep} = require('lodash');

mongoose.connect(process.env.MONGO_URI, {useNewUrlParser: true, useUnifiedTopology: true});
app.use(cors())
app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())

const errorHandler = (err) => {
  console.log('error handler :', err);
}

const userSchema = mongoose.Schema({
  username: {
    type: String,
    required: true
  }
})
const logSchema = mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  duration: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  }
});
const User = mongoose.model('User', userSchema);
const Log = mongoose.model('Log', logSchema);

const createAndSaveNewUser = (username, done) => {
  const user = new User({username});
  user.save(done);
};

const findUserUsernameById = (userId, withId, done) => {
  if (withId) {
    User.findById(userId).select('-__v').exec(done)
  } else {
    User.findById(userId).select('-_id -__v').exec(done)
  }
};

const findAllUsers = (done) => {
  User.find().exec(done);
};

const createAndSaveLog = (username, date, duration, description, done) => {
  const log = new Log({
    username,
    date,
    duration,
    description
  });
  log.save(done);
};


app.use(express.static('public'))

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

app.post('/api/exercise/new-user', (req, res) => {
  let {username} = req.body;
  createAndSaveNewUser(username, (err, data) => {
    if (err) return errorHandler(err);
    let d = data.toJSON();
    delete d['__v'];
    res.json(d)
  });
});

app.post('/api/exercise/add', (req, res) => {
  let {userId, description, duration, date} = req.body;
  date = (!date || date === '') ? new Date() : new Date(date);
  date = date.toUTCString();
  findUserUsernameById(userId, false, (err, data) => {
    if (err || !data || !data.username) errorHandler(err);
    createAndSaveLog(data.username, date, duration, description, (err, data) => {
      if (err) errorHandler(err);
      let d = data.toJSON();
      d.date = d.date.toDateString();
      d._id = userId;
      delete d['__v'];
      res.json(d);
    });
  });
});

app.get('/api/exercise/users', (req, res) => {
  findAllUsers((err, data) => {
    if (err || !data) errorHandler(err);
    res.json(data);
  })
});

const findLogsByUserId = (userId, limit, _from, to, done) => {
  let result = {};
  findUserUsernameById(userId, true, (err, data) => {
    if (err || !data) return done(err);
    result = cloneDeep(data.toObject());
    let query = Log.find({username: result.username});
    if (_from) query.where('date').gte(_from);
    if (to) query.where('date').lte(to);
    if (limit) query.limit(limit);
    query.select('-_id -__v -username').exec((err, data) => {
      if (err) return done(err);
      result['count'] = data.length;
      result['log'] = []
      for (let i = 0; i < data.length; i++) {
        result.log.push({
          duration: data[i].duration,
          description: data[i].description,
          date: data[i].date.toUTCString()
        })
      }
      return done(null, result)
    });
  });
};

app.get('/api/exercise/log', (req, res) => {
  let {userId, limit, to} = req.query;
  limit = Number(limit)
  let _from = req.query['from'];
  findLogsByUserId(userId, limit, _from, to, (err, data) => {
    if (err) errorHandler(err);
    res.json(data);
  });
});

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
      .send(errMessage)
})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
