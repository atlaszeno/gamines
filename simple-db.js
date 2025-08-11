
const fs = require('fs');
const path = require('path');

class SimpleDB {
  constructor(dbPath = './data') {
    this.dbPath = dbPath;
    this.ensureDbDirectory();
  }

  ensureDbDirectory() {
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
  }

  getCollectionPath(collection) {
    return path.join(this.dbPath, `${collection}.json`);
  }

  async find(collection, query = {}) {
    try {
      const filePath = this.getCollectionPath(collection);
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Simple query matching
      if (Object.keys(query).length === 0) {
        return data;
      }

      return data.filter(item => {
        return Object.keys(query).every(key => item[key] === query[key]);
      });
    } catch (error) {
      console.error('Error reading from SimpleDB:', error);
      return [];
    }
  }

  async findOne(collection, query = {}) {
    const results = await this.find(collection, query);
    return results[0] || null;
  }

  async insert(collection, document) {
    try {
      const filePath = this.getCollectionPath(collection);
      let data = [];

      if (fs.existsSync(filePath)) {
        data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }

      // Add ID if not present
      if (!document._id) {
        document._id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      }

      data.push(document);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      
      return document;
    } catch (error) {
      console.error('Error writing to SimpleDB:', error);
      throw error;
    }
  }

  async update(collection, query, update) {
    try {
      const filePath = this.getCollectionPath(collection);
      if (!fs.existsSync(filePath)) {
        return { modifiedCount: 0 };
      }

      let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      let modifiedCount = 0;

      data = data.map(item => {
        const matches = Object.keys(query).every(key => item[key] === query[key]);
        if (matches) {
          modifiedCount++;
          return { ...item, ...update };
        }
        return item;
      });

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return { modifiedCount };
    } catch (error) {
      console.error('Error updating SimpleDB:', error);
      throw error;
    }
  }

  async delete(collection, query) {
    try {
      const filePath = this.getCollectionPath(collection);
      if (!fs.existsSync(filePath)) {
        return { deletedCount: 0 };
      }

      let data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const originalLength = data.length;

      data = data.filter(item => {
        return !Object.keys(query).every(key => item[key] === query[key]);
      });

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return { deletedCount: originalLength - data.length };
    } catch (error) {
      console.error('Error deleting from SimpleDB:', error);
      throw error;
    }
  }
}

module.exports = { SimpleDB };
