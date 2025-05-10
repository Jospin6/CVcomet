// redux/experience/experienceSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@/redux/store'; // Assure-toi que tu as bien configuré le store
import axios from 'axios';

type Experience = {
  id: string;
  title: string;
  company: string;
  location: string;
  start: string;
  end?: string;
  userId: string;
  description?: string
};

interface ExperienceState {
  experiences: Experience[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

// Initial state
const initialState: ExperienceState = {
  experiences: [],
  status: 'idle',
  error: null,
};

// Thunks pour appeler l'API
export const fetchExperiences = createAsyncThunk<Experience[], string>(
  'experience/fetchExperiences',
  async (userId: string) => {
    const response = await axios.get(`/api/experiences?userId=${userId}`);
    return response.data;
  }
);

export const addExperience = createAsyncThunk<Experience, Omit<Experience, 'id'>>(
  'experience/addExperience',
  async (newExperience) => {
    const response = await axios.post('/api/experiences', newExperience);
    return response.data;
  }
);

export const updateExperience = createAsyncThunk<Experience, Experience>(
  'experience/updateExperience',
  async (updatedExperience) => {
    const response = await axios.put(`/api/experiences/${updatedExperience.id}`, updatedExperience);
    return response.data;
  }
);

export const deleteExperience = createAsyncThunk<string, string>(
  'experience/deleteExperience',
  async (experienceId: string) => {
    await axios.delete(`/api/experiences/${experienceId}`);
    return experienceId;
  }
);

// Experience slice
const experienceSlice = createSlice({
  name: 'experience',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchExperiences.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchExperiences.fulfilled, (state, action: PayloadAction<Experience[]>) => {
        state.status = 'succeeded';
        state.experiences = action.payload;
      })
      .addCase(fetchExperiences.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch experiences';
      })
      .addCase(addExperience.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(addExperience.fulfilled, (state, action: PayloadAction<Experience>) => {
        state.status = 'succeeded';
        state.experiences.push(action.payload);
      })
      .addCase(addExperience.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to add experience';
      })
      .addCase(updateExperience.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updateExperience.fulfilled, (state, action: PayloadAction<Experience>) => {
        state.status = 'succeeded';
        const index = state.experiences.findIndex((experience) => experience.id === action.payload.id);
        if (index !== -1) {
          state.experiences[index] = action.payload;
        }
      })
      .addCase(updateExperience.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to update experience';
      })
      .addCase(deleteExperience.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(deleteExperience.fulfilled, (state, action: PayloadAction<string>) => {
        state.status = 'succeeded';
        state.experiences = state.experiences.filter((experience) => experience.id !== action.payload);
      })
      .addCase(deleteExperience.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to delete experience';
      });
  },
});

// Selectors
export const selectExperiences = (state: RootState) => state.experience.experiences;
export const selectExperienceStatus = (state: RootState) => state.experience.status;
export const selectExperienceError = (state: RootState) => state.experience.error;

export default experienceSlice.reducer;
