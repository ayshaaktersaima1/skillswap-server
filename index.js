const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

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

const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`))

const verifyToken = async (req, res, next) => {

    const authHeader = req?.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer')) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const { payload } = await jwtVerify(token, JWKS);
        console.log(payload)
        next();

    }
    catch (error) {
        return res.status(403).json({ message: "Forbidden" });
    }
}


async function run() {
    try {

        const db = client.db('skillswap');
        const tasksCollection = db.collection('tasks');
        const proposalCollection = db.collection('proposals');
        const paymentsCollection = db.collection('payments');
        const userCollection = db.collection('user');
        const reviewsCollection = db.collection('reviewsCollection');

        app.post('/api/tasks', verifyToken, async (req, res) => {

            const taskInfo = req.body;
            const result = await tasksCollection.insertOne(taskInfo);
            res.json(result);

        })
        app.get('/api/tasks', async (req, res) => {

            const { page = 1, limit = 9 } = req.query;
            const skip = (Number(page) - 1) * Number(limit);


            const { status, search, category } = req.query;

            const q = {};
            if (status) {
                q.status = status;
            }

            if (search) {
                q.title = {
                    $regex: search,
                    $options: 'i',
                };
            }
            if (category) {
                q.category = category;
            }

            const result = await tasksCollection.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();

            const totalTask = await tasksCollection.countDocuments(q);
            totalPage = Math.ceil(totalTask / Number(limit))

            res.json({ data: result, page: Number(page), totalPage });


        })

        app.get('/api/allTaskForAdmin', verifyToken, async (req, res) => {
            const result = await tasksCollection.find().toArray();
            res.json(result);
        })
        app.get('/api/my-tasks/:clientId', verifyToken, async (req, res) => {
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


        app.patch('/api/tasks/:taskId', verifyToken, async (req, res) => {
            const { taskId } = req.params;

            const updatedTask = req.body;

            const result = await tasksCollection.updateOne(
                { _id: new ObjectId(taskId) },
                { $set: updatedTask }
            )
            await proposalCollection.updateMany(
                { taskId: taskId },
                {
                    $set: {
                        taskTitle: updatedTask.title
                    }
                }
            );


            res.json(result)
        })
        app.delete('/api/tasks/:taskId', verifyToken, async (req, res) => {
            const { taskId } = req.params;

            const updatedTask = req.body;

            const result = await tasksCollection.deleteOne(
                { _id: new ObjectId(taskId) }
            )


            res.json(result)
        })



        app.get('/api/receivedProposals/:clientId', verifyToken, async (req, res) => {

            const { clientId } = req.params;
            const result = await proposalCollection.find({ clientId }).toArray();
            res.json(result);

        })

        // for client rejecting proposal

        app.patch('/api/rejectingProposal/:proposalId', verifyToken, async (req, res) => {
            const { proposalId } = req.params;

            const { status } = req.body;

            const result = await proposalCollection.updateOne({ _id: new ObjectId(proposalId) },
                {
                    $set: { status: status }
                })

            res.json(result);
        })




        app.post('/api/payments', verifyToken, async (req, res) => {
            const paymentInfo = req.body;

            const isExist = await paymentsCollection.findOne({
                transaction_id: paymentInfo.transaction_id,
            });

            if (isExist) {
                return res.json({
                    message: 'Payment Already done',
                });
            }

            const alreadyAccepted = await proposalCollection.findOne({
                taskId: paymentInfo.taskId,
                status: 'accepted',
            });

            if (alreadyAccepted) {
                return res.status(409).json({
                    message: 'One proposal is already accepted for this task',
                });
            }

            const result = await paymentsCollection.insertOne({
                ...paymentInfo,
                amount: Number(paymentInfo.amount),
                paid_at: new Date().toISOString(),
            });

            await proposalCollection.updateOne(
                { _id: new ObjectId(paymentInfo.proposalId) },
                {
                    $set: {
                        status: 'accepted',
                    },
                }
            );

            await proposalCollection.updateMany(
                {
                    taskId: paymentInfo.taskId,
                    _id: {
                        $ne: new ObjectId(paymentInfo.proposalId),
                    },
                },
                {
                    $set: {
                        status: 'rejected',
                    },
                }
            );

            await tasksCollection.updateOne(
                { _id: new ObjectId(paymentInfo.taskId) },
                {
                    $set: {
                        status: 'in progress',
                        acceptedProposalId: paymentInfo.proposalId,
                        selectedFreelancerId: paymentInfo.freelancersId,
                    },
                }
            );

            res.json(result);
        });


        app.get('/api/payments', verifyToken, async (req, res) => {

            const result = await paymentsCollection.find().toArray();
            res.json(result)

        })
        app.get('/api/paymentInfo/:clientId', verifyToken, async (req, res) => {

            const { clientId } = req.params;
            const result = await paymentsCollection.find({
                client_id
                    : clientId
            }).toArray();
            res.json(result)

        })
        // all users except admin

        app.get('/api/users', verifyToken, async (req, res) => {

            const result = await userCollection.find({
                role: {
                    $in: ['client', 'freelancer']
                }
            }).toArray();
            res.json(result)

        })

        // all freelancers
        app.get('/api/freelancers', async (req, res) => {
            const result = await userCollection.find({ role: { $in: ['freelancer'] } }).sort({ created_at: -1 }).toArray();

            res.json(result)
        })

        // for getting user by email to see if they are blocked or not

        app.get('/api/users-for-status/:email', async (req, res) => {
            const { email } = req.params;

            const result = await userCollection.findOne({ email });

            if (!result) {
                return res.json({
                    isBlocked: false,
                });
            }

            res.json({
                isBlocked: result?.isBlocked === true,
            });
        });



        // for blocking,unblocking

        app.patch('/api/users/:id', verifyToken, async (req, res) => {

            const { id } = req.params;
            const { isBlocked } = req.body;

            const result = await userCollection.updateOne(
                { _id: new ObjectId(id) },
                {
                    $set: {
                        isBlocked: isBlocked
                    }
                }
            );
            res.json(result);

        })



        // freelancer

        app.get(`/api/freelancerInfo/:freelancersId`, async (req, res) => {
            const { freelancersId } = req.params;
            const result = await userCollection.findOne({
                _id: new ObjectId(freelancersId)
            });
            res.json(result)

        })
        app.patch('/api/freelancerInfo/:freelancersId', verifyToken, async (req, res) => {
            const { freelancersId } = req.params;
            const freelancersInfo = req.body;

            const updatedInfo = {
                name: freelancersInfo.name,
                image: freelancersInfo.image,
                bio: freelancersInfo.bio,
                skills: Array.isArray(freelancersInfo.skills)
                    ? freelancersInfo.skills
                    : freelancersInfo.skills
                        .split(',')
                        .map(skill => skill.trim())
                        .filter(Boolean),
                hourlyRate: Number(freelancersInfo.hourlyRate),
                updatedAt: new Date(),
            };

            const result = await userCollection.updateOne(
                { _id: new ObjectId(freelancersId) },
                { $set: updatedInfo }
            );

            res.json(result);
        });

        app.post('/api/proposals', verifyToken, async (req, res) => {

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
        app.get('/api/myProposals/:freelancersId', verifyToken, async (req, res) => {

            const { freelancersId } = req.params;
            const { status } = req.query;

            const q = { freelancersId }

            if (status) {
                q.status = status;
            }

            const result = await proposalCollection.find(q).toArray();
            res.json(result);

        })




        app.get('/api/checkProposal/:taskId/:freelancersId', verifyToken, async (req, res) => {
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

        app.get('/api/paymentInfoFreelancer/:freelancersId', verifyToken, async (req, res) => {

            const { freelancersId } = req.params;
            const result = await paymentsCollection.find({
                freelancer_id
                    : freelancersId
            }).toArray();

            res.json(result)

        })

        // for jobs that is completed by a freelancer

        app.get('/api/finishedJobs/:freelancersId', async (req, res) => {
            const { freelancersId } = req.params;

            const result = await tasksCollection.find({

                completedBy: freelancersId
            }).toArray();

            res.json(result);
        });

        app.post('/api/reviews', verifyToken, async (req, res) => {
            const reviewInfo = req.body;

            const result = await reviewsCollection.insertOne(reviewInfo);

            res.json(result);
        });
        app.get('/api/reviews', async (req, res) => {
            const result = await reviewsCollection
                .find()
                .sort({ created_at: -1 })
                .limit(6)
                .toArray();

            res.json(result);
        });
        app.get('/api/reviews/:freelancersEmail', async (req, res) => {
            const { freelancersEmail } = req.params;

            const result = await reviewsCollection.find({

                completedByEmail: freelancersEmail
            }).toArray();

            res.json(result);
        });
        app.get('/api/onlyClient/:clientId', async (req, res) => {
            const { clientId } = req.params;

            const result = await userCollection.findOne({
                _id: new ObjectId(clientId)
            });

            res.json({ image: result?.image || '' });
        });








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