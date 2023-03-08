const express = require("express");
const res = require("express/lib/response");
const env = require("dotenv").config()
const {GoogleAuth} = require('google-auth-library');
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
  });
const openai = new OpenAIApi(configuration);
  

app=express()

app.use(express.json())

const port=process.env.PORT || 8080;

const reqDurationHandler = ()=>{
    return new Promise(function(resolve, reject) {
      
        setTimeout(resolve, 20000);
    })
}

const sendAsynchronusMessage = async(response,space,thread)=>{
    const auth = new GoogleAuth({
        keyFile: "credentials.json",
        scopes: ['https://www.googleapis.com/auth/chat.bot',
                'https://www.googleapis.com/auth/chat.messages',
                'https://www.googleapis.com/auth/chat.messages.create'],
    });
    try {
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

const handler = async(req,res)=>{
    const space = req.body.space.name
    const thread = req.body.message.thread.name
    try {
        console.time("request-time")
        const gptPromise = openai.createChatCompletion({
            model: "gpt-3.5-turbo",
            messages: [{"role": "user", "content": `${req.body.message.text}`}],
        });
        
        const timePromise = reqDurationHandler()
        const principalPromise = Promise.race([gptPromise, timePromise])
        const result = await principalPromise
        if(result!=undefined){
            resp={
             "text": `${(result.data.choices[0].message.content).trim()}`
             }
             res.status(200).json(resp)
        } else{
            resp={
                "text": "This request is taking a little longer to process. Kindly wait for a response"
                }
            res.status(200).json(resp)
            const gptResponse = await gptPromise
            await sendAsynchronusMessage(gptResponse,space,thread)
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