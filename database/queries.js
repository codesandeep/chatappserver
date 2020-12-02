const { Pool, Client } = require("pg");
var db = require("./pool");
// pool = new Pool({
// user: "postgres",
// host: "localhost",
// database: "discussions",
// password: "",
// port: 5432
// });
var pool = db.getPool();
module.exports.getChatList = function() {
  return new Promise((resolve, reject) => {
    pool.query("SELECT id,chatname FROM chatlist", (err, res) => {
      if (res) {
        resolve(res.rows);
      } else {
        reject("error");
      }
    });
  });
};

module.exports.addToChatList = function(chatname, id) {
  return new Promise((resolve, reject) => {
    pool.query(
      "INSERT INTO chatlist (chatname, id) VALUES ($1,$2)",
      [chatname, id],
      (err, res) => {
        if (res) {
          resolve("success");
        } else {
          reject("error");
        }
      }
    );
  });
};

module.exports.removeFromChatList = function(id) {
  return new Promise((resolve, reject) => {
    pool.query("DELETE FROM chatlist WHERE id=$1", [id], (err, res) => {
      if (res) {
        resolve("success");
      } else {
        reject("error");
      }
    });
  });
};

module.exports.getMessages = function(id) {
  return new Promise((resolve, reject) => {
    pool.query("SELECT content FROM messages WHERE id=$1", [id], (err, res) => {
      if (res.rows[0]) {
        resolve(res.rows[0].content);
      } else {
        reject("error");
      }
    });
  });
};

module.exports.getUsers = function(id) {
  return new Promise((resolve, reject) => {
    pool.query("SELECT username,password FROM userprofile", (err, res) => {
      if (res.rows) {
        console.log(res.rows[0].passwordhash);
        resolve(res.rows[0].passwordhash);
      } else {
        reject("error");
      }
    });
  });
};
module.exports.findUser = function(username) {
  return new Promise((resolve, reject) => {
    pool.query(
      "SELECT passwordhash FROM userprofile WHERE username=$1",
      [username],
      (err, res) => {
        if (res.rows) {
          resolve(res.rows);
        } else {
          reject("error");
        }
      }
    );
  });
};
module.exports.addUser = function(data) {
  return new Promise((resolve, reject) => {
    pool.query(
      "INSERT INTO userprofile (username, passwordhash, email) VALUES ($1,$2,$3)",
      [data.username, data.passwordhash, data.email],
      (err, res) => {
        if (err) {
          reject(err.detail);
        } else {
          resolve("success");
        }
      }
    );
  });
};
module.exports.addMessageToServer = function(msg, id) {
  return new Promise((resolve, reject) => {
    pool.query(
      "INSERT INTO messages (content, id) VALUES ($1,$2) ON CONFLICT ON CONSTRAINT id_uq DO UPDATE SET content = EXCLUDED.content",
      [msg, id],
      (err, res) => {
        if (res) {
          resolve("success");
        } else {
          reject("error");
        }
      }
    );
  });
};
