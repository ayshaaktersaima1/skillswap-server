const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express()
dotenv.config();
const port = process.env.PORT;
const uri = process.env.MONGODB_URL;







// permissions
app.use(cors());
app.use(express.json());






// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {

        const db = client.db('skillswap');
        const tasksCollection = db.collection('tasks');

        app.post('/api/tasks', async (req, res) => {

            const taskInfo = req.body;
            const result = await tasksCollection.insertOne(taskInfo);
            res.json(result);

        })
        app.get('/api/my-tasks/:clientId', async (req, res) => {
            const { clientId } = req.params;
            const result = await tasksCollection.find({ clientId }).toArray();
            res.json(result)
        })

        app.get('/api/tasks/:taskId', async (req, res) => {
            const { taskId } = req.params;

            const result = await tasksCollection.findOne({
                _id: new ObjectId(taskId),
            });

            res.json(result);
        });


        app.patch('/api/tasks/:taskId', async (req, res) => {
            const { taskId } = req.params;

            const updatedTask = req.body;

            const result = await tasksCollection.updateOne(
                { _id: new ObjectId(taskId) },
                { $set: updatedTask }
            )


            res.json(result)
        })











        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})