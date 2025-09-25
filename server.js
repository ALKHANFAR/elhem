const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'elhemDB';

// Data files (fallback)
const DATA_DIR = path.join(__dirname, 'data');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const TEAM_FILE = path.join(DATA_DIR, 'team.json');
const PERFORMANCE_FILE = path.join(DATA_DIR, 'performance.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// MongoDB client
let mongoClient;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MongoDB connection functions
async function connectToMongoDB() {
  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log('✅ Connected to MongoDB');
    return mongoClient.db(DB_NAME);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    throw error;
  }
}

async function getCollection(collectionName) {
  if (!mongoClient) {
    await connectToMongoDB();
  }
  return mongoClient.db(DB_NAME).collection(collectionName);
}

// Fallback functions for JSON files (in case MongoDB is down)
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

// Load data from file
async function loadData(filePath, defaultData = []) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return defaultData;
  }
}

// Save data to file
async function saveData(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Sync data between MongoDB and JSON files for CrewAI agents
async function syncDataToJSON() {
  try {
    console.log('🔄 Syncing MongoDB data to JSON files...');

    const tasksCollection = await getCollection('tasks');
    const teamCollection = await getCollection('teams');

    // Sync tasks
    const tasks = await tasksCollection.find({}).toArray();
    await saveData(TASKS_FILE, tasks);

    // Sync team
    const team = await teamCollection.find({}).toArray();
    await saveData(TEAM_FILE, team);

    console.log('✅ Data synced to JSON files');
  } catch (error) {
    console.error('❌ Error syncing data:', error);
  }
}

// Sync changes from JSON files back to MongoDB after CrewAI agent operations
async function syncJSONToMongoDB() {
  try {
    console.log('🔄 Syncing JSON changes to MongoDB...');

    const tasksCollection = await getCollection('tasks');
    const teamCollection = await getCollection('teams');

    // Load current JSON data
    const jsonTasks = await loadData(TASKS_FILE, []);
    const jsonTeam = await loadData(TEAM_FILE, []);

    // Clear and re-insert tasks
    if (jsonTasks.length > 0) {
      await tasksCollection.deleteMany({});
      await tasksCollection.insertMany(jsonTasks);
    }

    // Clear and re-insert team
    if (jsonTeam.length > 0) {
      await teamCollection.deleteMany({});
      await teamCollection.insertMany(jsonTeam);
    }

    console.log('✅ JSON changes synced to MongoDB');
  } catch (error) {
    console.error('❌ Error syncing to MongoDB:', error);
  }
}

// Initialize data
async function initializeData() {
  await ensureDataDir();

  try {
    // Connect to MongoDB
    await connectToMongoDB();

    // Sync MongoDB data to JSON files for CrewAI agents
    await syncDataToJSON();
  } catch (error) {
    console.log('⚠️ MongoDB connection failed, using JSON files as fallback');
  }

  // Load or create config data (always from JSON)
  let config = await loadData(CONFIG_FILE, {
    botPersonality: 'friendly',
    systemName: 'إلهام',
    version: '1.0.0'
  });
  await saveData(CONFIG_FILE, config);

  // Load or create performance data (always from JSON for now)
  let performance = await loadData(PERFORMANCE_FILE, []);
  await saveData(PERFORMANCE_FILE, performance);

  console.log('✅ Data initialized');
}

// API Routes

// Get tasks based on user role
app.get('/api/tasks', async (req, res) => {
  try {
    const userId = req.headers['user-id'];
    const userRole = req.headers['user-role'];

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'User authentication required' });
    }

    const tasksCollection = await getCollection('tasks');
    const teamCollection = await getCollection('teams');

    let filteredTasks;

    if (userRole === 'Executive') {
      // Executives can see all tasks
      filteredTasks = await tasksCollection.find({}).toArray();
    } else if (userRole === 'Manager') {
      // Managers can see their team's tasks and their own tasks
      const user = await teamCollection.findOne({ employeeId: userId });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get team members under this manager
      const teamMembers = await teamCollection.find({ managerId: userId }).toArray();
      const teamMemberIds = teamMembers.map(member => member.employeeId);

      // Include manager's own tasks
      teamMemberIds.push(userId);

      filteredTasks = await tasksCollection.find({
        assignedToId: { $in: teamMemberIds }
      }).toArray();
    } else {
      // Employees can only see their own tasks
      filteredTasks = await tasksCollection.find({ assignedToId: userId }).toArray();
    }

    res.json(filteredTasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all team members
app.get('/api/team', async (req, res) => {
  try {
    const teamCollection = await getCollection('teams');
    const team = await teamCollection.find({}).toArray();
    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get performance data
app.get('/api/performance', async (req, res) => {
  try {
    // For now, return empty array since performance data might not be in MongoDB yet
    // You can add a performance collection later
    res.json([]);
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get config
app.get('/api/config', async (req, res) => {
  try {
    const config = await loadData(CONFIG_FILE, {
      botPersonality: 'friendly',
      systemName: 'إلهام',
      version: '1.0.0'
    });
    res.json(config);
  } catch (error) {
    console.error('Error fetching config:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add new task
app.post('/api/tasks', async (req, res) => {
  try {
    const task = req.body;
    const tasksCollection = await getCollection('tasks');

    // Insert the task into MongoDB
    const result = await tasksCollection.insertOne(task);

    // Sync data to JSON files for CrewAI agents
    await syncDataToJSON();

    res.json({ success: true, taskId: task.taskId, insertedId: result.insertedId });
  } catch (error) {
    console.error('Error adding task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update task
app.put('/api/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    const tasksCollection = await getCollection('tasks');

    // Update the task in MongoDB
    const result = await tasksCollection.updateOne(
      { taskId: taskId },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Sync data to JSON files for CrewAI agents
    await syncDataToJSON();

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

// Authenticate user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // For now, simple password check (you should implement proper hashing)
    if (password !== '123456') {
      return res.status(401).json({ error: 'Invalid password' });
    }

    const teamCollection = await getCollection('teams');
    const user = await teamCollection.findOne({
      $or: [
        { name: username },
        { email: username },
        { employeeId: username }
      ]
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Convert MongoDB document to plain object and remove _id
    const userObj = { ...user };
    delete userObj._id;

    res.json({ success: true, user: userObj });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: error.message });
  }
});

// CrewAI Agent endpoints
app.post('/api/agents/employee', async (req, res) => {
  try {
    const { employeeId, message } = req.body;

    if (!employeeId || !message) {
      return res.status(400).json({ error: 'Employee ID and message are required' });
    }

    // Call Python CrewAI agent
    const pythonProcess = spawn('python3', ['crewai_agent.py', 'employee', employeeId, message], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      if (code === 0) {
        // Sync any changes made by the agent back to MongoDB
        try {
          await syncJSONToMongoDB();
        } catch (syncError) {
          console.error('Error syncing to MongoDB:', syncError);
        }
        res.json({ success: true, response: output.trim() });
      } else {
        console.error('Python process error:', errorOutput);
        res.status(500).json({ error: 'Agent processing failed', details: errorOutput });
      }
    });

  } catch (error) {
    console.error('Error calling employee agent:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agents/manager', async (req, res) => {
  try {
    const { managerId, message } = req.body;

    if (!managerId || !message) {
      return res.status(400).json({ error: 'Manager ID and message are required' });
    }

    // Call Python CrewAI agent
    const pythonProcess = spawn('python3', ['crewai_agent.py', 'manager', managerId, message], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      if (code === 0) {
        // Sync any changes made by the agent back to MongoDB
        try {
          await syncJSONToMongoDB();
        } catch (syncError) {
          console.error('Error syncing to MongoDB:', syncError);
        }
        res.json({ success: true, response: output.trim() });
      } else {
        console.error('Python process error:', errorOutput);
        res.status(500).json({ error: 'Agent processing failed', details: errorOutput });
      }
    });

  } catch (error) {
    console.error('Error calling manager agent:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function startServer() {
  await initializeData();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);