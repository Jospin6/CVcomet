// redux/education/educationSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@/redux/store'; // Assure-toi que tu as bien configuré le store
import axios from 'axios';

type Education = {
  id: string;
  degree: string;
  school: string;
  start: string;
  end?: string;
  userId: string;
};

interface EducationState {
  education: Education[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

// Initial state
const initialState: EducationState = {
  education: [],
  status: 'idle',
  error: null,
};

// Thunks pour appeler l'API
export const fetchEducation = createAsyncThunk<Education[], string>(
  'education/fetchEducation',
  async (userId: string) => {
    const response = await axios.get(`/api/educations?userId=${userId}`);
    return response.data;
  }
);

export const addEducation = createAsyncThunk<Education, Omit<Education, 'id'>>(
  'education/addEducation',
  async (newEducation) => {
    const response = await axios.post('/api/educations', newEducation);
    return response.data;
  }
);

export const updateEducation = createAsyncThunk<Education, Education>(
  'education/updateEducation',
  async (updatedEducation) => {
    const response = await axios.put(`/api/educations/${updatedEducation.id}`, updatedEducation);
    return response.data;
  }
);

export const deleteEducation = createAsyncThunk<string, string>(
  'education/deleteEducation',
  async (educationId: string) => {
    await axios.delete(`/api/educations/${educationId}`);
    return educationId;
  }
);

// Education slice
const educationSlice = createSlice({
  name: 'education',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEducation.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchEducation.fulfilled, (state, action: PayloadAction<Education[]>) => {
        state.status = 'succeeded';
        state.education = action.payload;
      })
      .addCase(fetchEducation.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch education';
      })
      .addCase(addEducation.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(addEducation.fulfilled, (state, action: PayloadAction<Education>) => {
        state.status = 'succeeded';
        state.education.push(action.payload);
      })
      .addCase(addEducation.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to add education';
      })
      .addCase(updateEducation.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updateEducation.fulfilled, (state, action: PayloadAction<Education>) => {
        state.status = 'succeeded';
        const index = state.education.findIndex((edu) => edu.id === action.payload.id);
        if (index !== -1) {
          state.education[index] = action.payload;
        }
      })
      .addCase(updateEducation.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to update education';
      })
      .addCase(deleteEducation.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(deleteEducation.fulfilled, (state, action: PayloadAction<string>) => {
        state.status = 'succeeded';
        state.education = state.education.filter((edu) => edu.id !== action.payload);
      })
      .addCase(deleteEducation.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to delete education';
      });
  },
});

// Selectors
export const selectEducation = (state: RootState) => state.education.education;
export const selectEducationStatus = (state: RootState) => state.education.status;
export const selectEducationError = (state: RootState) => state.education.error;

export default educationSlice.reducer;
