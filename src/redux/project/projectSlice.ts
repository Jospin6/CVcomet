// redux/project/projectSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@/redux/store'; // Assure-toi que tu as bien configuré le store
import axios from 'axios';

export type Project = {
  id: string;
  start: string;
  end?: string;
  title: string;
  url: string;
  userId: string;
};

interface ProjectState {
  projects: Project[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

// Initial state
const initialState: ProjectState = {
  projects: [],
  status: 'idle',
  error: null,
};

// Thunks pour appeler l'API
export const fetchProjects = createAsyncThunk<Project[], string>(
  'project/fetchProjects',
  async (userId: string) => {
    const response = await axios.get(`/api/projects?userId=${userId}`);
    return response.data;
  }
);

export const addProject = createAsyncThunk<Project, Omit<Project, 'id'>>(
  'project/addProject',
  async (newProject) => {
    const response = await axios.post('/api/projects', newProject);
    return response.data;
  }
);

export const updateProject = createAsyncThunk<Project, Project>(
  'project/updateProject',
  async (updatedProject) => {
    const response = await axios.put(`/api/projects/${updatedProject.id}`, updatedProject);
    return response.data;
  }
);

export const deleteProject = createAsyncThunk<string, string>(
  'project/deleteProject',
  async (projectId: string) => {
    await axios.delete(`/api/projects/${projectId}`);
    return projectId;
  }
);

// Project slice
const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchProjects.fulfilled, (state, action: PayloadAction<Project[]>) => {
        state.status = 'succeeded';
        state.projects = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch projects';
      })
      .addCase(addProject.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(addProject.fulfilled, (state, action: PayloadAction<Project>) => {
        state.status = 'succeeded';
        state.projects.push(action.payload);
      })
      .addCase(addProject.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to add project';
      })
      .addCase(updateProject.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updateProject.fulfilled, (state, action: PayloadAction<Project>) => {
        state.status = 'succeeded';
        const index = state.projects.findIndex((proj) => proj.id === action.payload.id);
        if (index !== -1) {
          state.projects[index] = action.payload;
        }
      })
      .addCase(updateProject.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to update project';
      })
      .addCase(deleteProject.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(deleteProject.fulfilled, (state, action: PayloadAction<string>) => {
        state.status = 'succeeded';
        state.projects = state.projects.filter((proj) => proj.id !== action.payload);
      })
      .addCase(deleteProject.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to delete project';
      });
  },
});

// Selectors
export const selectProjects = (state: RootState) => state.project.projects;
export const selectProjectStatus = (state: RootState) => state.project.status;
export const selectProjectError = (state: RootState) => state.project.error;

export default projectSlice.reducer;
