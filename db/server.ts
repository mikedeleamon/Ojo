import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

import User from '../models/User'; // No need for .ts extension if using TypeScript
import Settings from '../models/Settings';
import ClothingArticle from '../models/ClothingArticle';

const app = express();

// Middleware
app.use(
    cors({
        origin: 'http://localhost:3000',
    })
);
app.use(express.json());

// MongoDB Connection
const uri =
    'mongodb+srv://mikeamon21:OjoDev@ojodevdb.gk3gnhk.mongodb.net/OjoDevDB?retryWrites=true&w=majority';
mongoose
    .connect(uri//, 
        //{
       /// useNewUrlParser: true,
       // useUnifiedTopology: true,
    //}
)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Error connecting to MongoDB:', err));



// RESTful Routes

// Create a new User
app.post('/add-user', async (req: Request, res: Response) => {
    const user = new User(req.body);
    try {
        const newUser = await user.save();
        res.status(201).json(newUser);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all documents
// app.get('/get-data', async (req: Request, res: Response) => {
//     try {
//         const examples = await ExampleModel.find();
//         res.json(examples);
//     } catch (err) {
//         res.status(500).json({ message: err.message });
//     }
// });

// Get a specific document by ID
// app.get('/api/examples/:id', async (req: Request, res: Response) => {
//     try {
//         const example = await ExampleModel.findById(req.params.id);
//         if (!example) return res.status(404).json({ message: 'Not Found' });
//         res.json(example);
//     } catch (err) {
//         res.status(500).json({ message: err.message });
//     }
// });

// Create a new document
// app.post('/save-settings', async (req: Request, res: Response) => {
//     const example = new ExampleModel(req.body);
//     try {
//         const newExample = await example.save();
//         res.status(201).json(newExample);
//     } catch (err) {
//         res.status(400).json({ message: err.message });
//     }
// });

// Update a document
// app.put('/save-settings', async (req: Request, res: Response) => {
//     try {
//         const updatedExample = await ExampleModel.findByIdAndUpdate(
//             req.params.id,
//             req.body,
//             { new: true }
//         );
//         if (!updatedExample)
//             return res.status(404).json({ message: 'Not Found' });
//         res.json(updatedExample);
//     } catch (err) {
//         res.status(400).json({ message: err.message });
//     }
// });

// Delete a document
// app.delete('/api/examples/:id', async (req: Request, res: Response) => {
//     try {
//         const deletedExample = await ExampleModel.findByIdAndDelete(
//             req.params.id
//         );
//         if (!deletedExample)
//             return res.status(404).json({ message: 'Not Found' });
//         res.json({ message: 'Deleted Successfully' });
//     } catch (err) {
//         res.status(500).json({ message: err.message });
//     }
// });

// Start Server
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
