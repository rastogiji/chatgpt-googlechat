const express = require("express");
const fs = require('fs')
const res = require("express/lib/response");
const env = require("dotenv").config()
const {GoogleAuth} = require('google-auth-library');
const { Configuration, OpenAIApi } = require("openai");
const {generateConnection,saveMessageToDB, getMessagesFromDB} = require("./db");
const path = require("path");

// Initialilsing OpenAI Client
const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
const openai = new OpenAIApi(configuration);
  

app=express()

app.use(express.json())

const port=process.env.PORT || 8080;

// Returns Promise to Ensure Request is completing before Google Chat 30s window closes
const reqDurationHandler = ()=>{
    return new Promise(function(resolve, reject) {
      
        setTimeout(resolve, 15000);
    })
}

// Send Message to Google Chat asynchronously if the request is taking too long
const sendAsynchronusMessage = async(response,space,thread,query)=>{
    const auth = new GoogleAuth({
        keyFile: "credentials.json",
        scopes: ['https://www.googleapis.com/auth/chat.bot',
                'https://www.googleapis.com/auth/chat.messages',
                'https://www.googleapis.com/auth/chat.messages.create'],
    });
    try {
        await saveMessageToDB(thread,((response.data.choices[0].message.content).trim()),space,query,0)
        const client = await auth.getClient();
        const url = `https://chat.googleapis.com/v1/${space}/messages`
        const body = {
            "text": `${(response.data.choices[0].message.content).trim()}`,
            "thread": {
                "threadKey": `${thread}`,
            }
        }
        const request = {
            url: `${url}`,
            method: "POST",
            body:  `${JSON.stringify(body)}`,
            headers: {
                "Content-type": "application/json; charset=UTF-8"
            }
        }
        const res = await client.request(request)
        console.log(res.data)
    } catch (err) {
        console.error(err)
    }
}

// Builds Request Body to the openAI API from the past messages
const constructMessages = async (thread,space,query)=>{
    let messages = [
        {"role": "system", "content": "You are a helpful Assistant that answers questions and generates code."}
    ]
    const previousMessages = await getMessagesFromDB(thread,space,query)
    previousMessages.forEach(message => {
        if(message.user == 1){
            row = {"role":"user", "content":`${decodeURI(message.message)}`}
        } else{
            row = {"role":"assistant", "content":`${decodeURI(message.message)}`}
        }
        messages.push(row)
    });
    return messages;
}

// All DB Operations before a Request to Open AI is made
const initialDBOperations = async (thread,space,question,query,user)=>{
    await saveMessageToDB(thread,question,space,query,user)

    //Getting All Messages in a particular thread in the last 10 mins
    const messages = await constructMessages(thread,space,query)
    console.log(`Inside initialDBOperations: ${messages}`)
    return messages
}

const handler = async(req,res)=>{
    // Getting Relevant Request Details
    const space = req.body.space.name
    const thread = req.body.message.thread.name
    const question = req.body.message.text

    // Creating DB Connections
    const query = await generateConnection()
    try {
        console.time("request-time")

        const messages = await initialDBOperations(thread,space,question,query,1)
        const gptPromise = openai.createChatCompletion({
              model: "gpt-3.5-turbo",
              messages: messages,
        });
        
        const timePromise = reqDurationHandler()
        const principalPromise = Promise.race([gptPromise, timePromise])
        const result = await principalPromise
        if(result!=undefined){
            resp={
              "text": `${(result.data.choices[0].message.content).trim()}`
            }
            await saveMessageToDB(thread,((result.data.choices[0].message.content).trim()),space,query,0)
            res.status(200).json(resp)
        } else{
             resp={
                 "text": "This request is taking a little longer to process. Kindly wait for a response"
                 }
             res.status(200).json(resp)
             const gptResponse = await gptPromise
             await sendAsynchronusMessage(gptResponse,space,thread,query)
        }
        console.timeEnd("request-time")
    } catch (err) {
        console.error(err)
        res.status(500).send("Internal Server Error. Contact the Administrator")
        
    }
}
app.post("/", handler)
app.get("/", (req,res)=>{
    res.status(200).send("This is a wrapper which uses ChatGPT to answer questions and used for integration with downstream applications")
})
app.listen(port, err=>{
    if(err){
        console.log(`Error Starting server: ${err}`)
    } else{
        console.log(`Server Started on Port: ${port}`)
    }
})