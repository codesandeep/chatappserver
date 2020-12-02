var app = require("express")();
var http = require("http").createServer(app);
var io = require("socket.io")(http);
var bodyParser = require("body-parser");
const cors = require("cors");
const bcrypt = require("bcrypt");
var queries = require("./database/queries");
var db = require("./database/pool");
var session = require("express-session");
var { Pool } = require("pg");
// const KnexSessionStore = require("connect-session-knex")(session);
// var pgSession = require("connect-pg-simple")(session);
const MongoStore = require("connect-mongo")(session);
// const Knex = require("knex");
// const knex = Knex({
//   client: "pg",
//   connection: {
//     host: "localhost",
//     user: "postgres",
//     password: "",
//     database: "discussions",
//     port: 5432
//   }
// });
// const store = new KnexSessionStore({
//   knex: knex,
//   tablename: "session"
// });
// var pgPool = new Pool({
//   user: "postgres",
//   host: "127.0.0.1",
//   database: "discussions",
//   password: ""
// });
var pgPool = db.getPool();
app.use(
  cors({
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  })
);
// let store = new pgSession({
//   pool: pgPool
// });
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  session({
    store: new MongoStore({
      url: "mongodb://localhost/discussions",
      autoRemove: "native"
    }),
    resave: false,
    saveUninitialized: true,
    secret: "simple secret to keep safe",
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    }
  })
);

findUserFromDb = function(username) {
  return queries.findUser(username);
};
async function loginCheck(user) {
  const userpasswordfromdb = await findUserFromDb(user.username);
  if (userpasswordfromdb.length < 1) return "User not found";
  const matches = await bcrypt.compare(
    user.password,
    userpasswordfromdb[0].passwordhash
  );
  if (matches) {
    console.log("logged in ");
    return "success";
  } else {
    console.log("wrong password");
    return "wrong password";
  }
}

async function registerUser(user) {
  const saltRounds = 10;
  const hash = await bcrypt.hash(user.password, saltRounds);
  let result = queries.addUser({
    username: user.username,
    passwordhash: hash,
    email: user.email
  });
  return result;
}

app.post("/register", function(req, res) {
  console.log("session id register:", req.session.id);
  let x = registerUser(req.body);
  x.then(function(result) {
    console.log("registration returns success", result);
    res.send(result);
  });
  x.catch(function(error) {
    console.log("registration returns error", error);
    res.send(error);
  });
});
app.post("/adduser", function(req, res) {
  queries.addToChatList(req.body.name, req.body.id);
  let chats = getChatsFromServer();
  chats.then(function(result) {
    res.send(result);
  });
  res.send();
});
app.get("/", function(req, res) {});

app.get("/home", function(req, res) {
  console.log(req.session);
  console.log("store is", req.session.store);
  if (req.session.user === undefined) {
    res.send("not logged in");
  }
});

app.get("/home/chats", function(req, res) {
  if (req.session.user === undefined) {
    res.send("not logged in");
  } else {
    let check = getChatsFromServer();
    check.then(function(result) {
      console.log("successfully got chats from server");
      res.send(result);
    });
    check.catch(function(error) {
      console.log("error while getting chats from server");
      res.send(error);
    });
  }
});
app.get("/home/user", function(req, res) {
  if (req.session.user === undefined) {
    res.send("not logged in");
  } else {
    res.send(req.session.user);
  }
});

app.get("/logout", function(req, res) {
  req.session.destroy();
  res.end();
});

app.get("/logincheck", function(req, res) {
  if (req.session.user) {
    res.send("logged in");
  } else {
    res.send("logged out");
  }
});

app.post("/login", function(req, res, next) {
  let loginPromise = new Promise(function(resolve, reject) {
    let check = loginCheck(req.body);
    if (check) {
      resolve(check);
    } else reject("error");
  });
  loginPromise.then(function(result) {
    console.log("login status :", result);
    if (result === "success") {
      console.log(req.session);
      req.session.user = req.body;
      req.session.save();
    }

    // next();
    res.send(result);
  });
  loginPromise.catch(function(result) {
    console.log("error while logging in", result);
    res.send(result);
  });
});

app.post("/removechat", function(req, res) {
  let removePromise = new Promise(function(resolve, reject) {
    let check=queries.removeFromChatList(req.body.id); 
    if(check){
      resolve(check);
    } else {
      reject('error');
    }});
    removePromise.then(function(result){
      queries.removeFromChatList(req.body.id);
      let check = getChatsFromServer();
        check.then(function(result) {
          console.log("successfully got chats from server");
          res.send(result);
        });
        check.catch(function(error) {
          console.log("error while getting chats from server");
          res.send(error);
        });
    })
});

getMessagesFromServer = function(id) {
  var getMessagePromise = new Promise(function(resolve, reject) {
    message = queries.getMessages(id);
    if (message === null) {
      reject("Error");
    } else {
      resolve(message);
    }
  });
  getMessagePromise.then(function(result) {
    io.to(id).emit("event_messageSent", result);
  });
  getMessagePromise.catch(function(error) {
    console.log(error);
  });
};

getChatsFromServer = function() {
  return new Promise(function(resolve, reject) {
    chat_list = queries.getChatList();
    if (chat_list === null) {
      reject("error");
    } else {
      resolve(chat_list);
    }
  });
  // getChatPromise.then(function(result) {
  //   console.log(result);
  //   // io.emit("event_chatListSent", result);
  // });
  // getChatPromise.catch(function(error) {
  //   console.log(result);
  //   // console.log(error);
  // });
};

io.on("connection", function(socket) {
  let current_room = "";
  socket.on("disconnect", function() {
    console.log("user disconnected");
    console.log("Leaving room", current_room);
    socket.leave(current_room);
  });
  socket.on("event_joinChat", function(id) {
    if (current_room != id) {
      console.log("Leaving room", current_room);
      socket.leave(current_room);
      current_room = id;
      socket.join(current_room);
    }
    console.log("joined ", current_room);
  });
  socket.on("event_chatMessageToServer", function(msg, id) {
    queries.addMessageToServer(msg, id);
    io.to(current_room).emit("event_chatMessageToClient", msg);
  });
  socket.on("event_getMessage", function(id) {
    getMessagesFromServer(id);
  });
  socket.on("event_loadChatList", function() {
    getChatsFromServer();
  });
  socket.on("event_removeChat", function(id) {
    queries.removeFromChatList(id);
    getChatsFromServer();
  });

  socket.on("event_addNewChat", function(chatname, id) {
    queries.addToChatList(chatname, id);
    getChatsFromServer();
  });
  console.log("a user connected");
});

http.listen(5000, function() {
  console.log("listening on *:5000");
});
