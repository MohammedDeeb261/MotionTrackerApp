// This is an empty shim for the Node.js http module
// It provides dummy implementations of commonly used methods to prevent errors
export default {
  createServer: () => ({
    listen: () => ({}),
    on: () => ({}),
    close: () => ({})
  }),
  get: () => ({}),
  request: () => ({
    on: () => ({}),
    end: () => ({})
  })
};

// Also export common methods directly
export const createServer = () => ({
  listen: () => ({}),
  on: () => ({}),
  close: () => ({})
});

export const get = () => ({
  on: () => ({}),
  end: () => ({})
});

export const request = () => ({
  on: () => ({}),
  end: () => ({})
});
