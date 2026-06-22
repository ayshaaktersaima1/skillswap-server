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
        const proposalCollection = db.collection('proposals');
        const paymentsCollection = db.collection('payments');
        const userCollection = db.collection('user');

        app.post('/api/tasks', async (req, res) => {

            const taskInfo = req.body;
            const result = await tasksCollection.insertOne(taskInfo);
            res.json(result);

        })
        app.get('/api/tasks', async (req, res) => {

            const { status } = req.query;

            const q = {};
            if (status) {
                q.status = status;
            }
            const result = await tasksCollection.find(q).toArray();
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
        app.delete('/api/tasks/:taskId', async (req, res) => {
            const { taskId } = req.params;

            const updatedTask = req.body;

            const result = await tasksCollection.deleteOne(
                { _id: new ObjectId(taskId) }
            )


            res.json(result)
        })



        app.get('/api/receivedProposals/:clientId', async (req, res) => {

            const { clientId } = req.params;
            const result = await proposalCollection.find({ clientId }).toArray();
            res.json(result);

        })

        // for client rejecting proposal

        app.patch('/api/rejectingProposal/:proposalId', async (req, res) => {
            const { proposalId } = req.params;

            const { status } = req.body;

            const result = await proposalCollection.updateOne({ _id: new ObjectId(proposalId) },
                {
                    $set: { status: status }
                })

            res.json(result);
        })


        app.post('/api/payments', async (req, res) => {

            const paymentInfo = req.body;

            const isExist = await paymentsCollection.findOne({ transaction_id: paymentInfo.transaction_id })

            if (isExist) {
                return res.json({
                    message: 'Payment Already done'
                })
            }

            const result = await paymentsCollection.insertOne({
                ...paymentInfo,
                amount: Number(paymentInfo.amount),
                paid_at: new Date().toISOString(),
            });

            await proposalCollection.updateOne({ _id: new ObjectId(paymentInfo.proposalId) },
                { $set: { status: 'accepted' } })

            await tasksCollection.updateOne({ _id: new ObjectId(paymentInfo.taskId) },
                { $set: { status: 'in progress' } })

            res.json(result);
        })

        app.get('/api/paymentInfo/:clientId', async (req, res) => {

            const { clientId } = req.params;
            const result = await paymentsCollection.find({
                client_id
                    : clientId
            }).toArray();
            res.json(result)

        })




        // freelancer

        app.get(`/api/freelancerInfo/:freelancersId`, async (req, res) => {
            const { freelancersId } = req.params;
            const result = await userCollection.findOne({
                _id: new ObjectId(freelancersId)
            });
            res.json(result)

        })
        app.patch(`/api/freelancerInfo/:freelancersId`, async (req, res) => {
            const { freelancersId } = req.params;
            const freelancersInfo = req.body;
            const result = await userCollection.updateOne({
                _id: new ObjectId(freelancersId)
            },
                {
                    $set: freelancersInfo
                });
            res.json(result)

        })

        app.post('/api/proposals', async (req, res) => {

            const proposalInfo = req.body;

            const alreadyApplied = await proposalCollection.findOne({
                taskId: proposalInfo.taskId,
                freelancersId: proposalInfo.freelancersId
            });

            if (alreadyApplied) {

                return res.status(409).json({
                    message: 'You already applied for this task',
                })
            }
            const result = await proposalCollection.insertOne(proposalInfo);
            res.json(result);

        })
        app.get('/api/myProposals/:freelancersId', async (req, res) => {

            const { freelancersId } = req.params;
            const { status } = req.query;

            const q = { freelancersId }

            if (status) {
                q.status = status;
            }

            const result = await proposalCollection.find(q).toArray();
            res.json(result);

        })




        app.get('/api/checkProposal/:taskId/:freelancersId', async (req, res) => {
            const { taskId, freelancersId } = req.params;

            const proposal = await proposalCollection.findOne({
                taskId,
                freelancersId,
            });

            if (proposal) {
                res.json({ alreadyApplied: true });
            } else {
                res.json({ alreadyApplied: false });
            }
        });

        app.get('/api/paymentInfoFreelancer/:freelancersId', async (req, res) => {

            const { freelancersId } = req.params;
            const result = await paymentsCollection.find({
                freelancer_id
                    : freelancersId
            }).toArray();

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