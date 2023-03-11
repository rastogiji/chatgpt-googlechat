const mysql = require("mysql");
const util = require("util")

// Connects to DB
const generateConnection = async ()=>{
    const connection  = mysql.createConnection({
        connectionLimit : 10,
        host            : `${process.env.MYSQL_HOST}`,
        user            : `${process.env.MYSQL_USER}`,
        password        : `${process.env.MYSQL_PASSWORD}`,
        database        : `${process.env.DB_NAME}`
    });
    await connection.connect(err=>{
        if (err) {
            console.error('error connecting: ' + err.stack);
            return;
        }
        console.log("Connected to DB")
    })
    const query = util.promisify(connection.query).bind(connection);
    return query
}

// Saves a Message to DB
const saveMessageToDB = async (thread,question,space,query,user)=>{
    question = question.replace("@chatgpt", "")
    question = question.trim()
    question = encodeURI(question)
    const insertQuery = `INSERT INTO Messages (thread_name,space_name,message,user) VALUES ("${thread}","${space}","${question}",${user});`
    try {
        await query(insertQuery)
    } catch (err) {
        throw err;
    }
}

// Fetches Past Messages fro Last 10 minutes
const getMessagesFromDB = async (thread,space,query)=>{
    const retrieveMessageQuery = `Select message,user,message_time from Messages where space_name="${space}" AND message_time >= NOW() - INTERVAL 5 MINUTE ORDER BY message_time ASC`
    try {
        const rows = await query(retrieveMessageQuery)
        return rows
    } catch (err) {
        throw err;
    }
}

module.exports = {generateConnection, saveMessageToDB, getMessagesFromDB}