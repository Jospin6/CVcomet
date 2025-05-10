// redux/certification/certificationSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from '@/redux/store'; // Assure-toi que tu as bien configuré le store
import axios from 'axios';

type Certification = {
  id: string;
  name: string;
  organization: string;
  date: string;
  userId: string;
  description?: string;
};

interface CertificationState {
  certifications: Certification[];
  status: 'idle' | 'loading' | 'succeeded' | 'failed';
  error: string | null;
}

// Initial state
const initialState: CertificationState = {
  certifications: [],
  status: 'idle',
  error: null,
};

// Thunks pour appeler l'API
export const fetchCertifications = createAsyncThunk<Certification[], string>(
  'certification/fetchCertifications',
  async (userId: string) => {
    const response = await axios.get(`/api/certifications?userId=${userId}`);
    return response.data;
  }
);

export const addCertification = createAsyncThunk<Certification, Omit<Certification, 'id'>>(
  'certification/addCertification',
  async (newCertification) => {
    const response = await axios.post('/api/certifications', newCertification);
    return response.data;
  }
);

export const updateCertification = createAsyncThunk<Certification, Certification>(
  'certification/updateCertification',
  async (updatedCertification) => {
    const response = await axios.put(`/api/certifications/${updatedCertification.id}`, updatedCertification);
    return response.data;
  }
);

export const deleteCertification = createAsyncThunk<string, string>(
  'certification/deleteCertification',
  async (certificationId: string) => {
    await axios.delete(`/api/certifications/${certificationId}`);
    return certificationId;
  }
);

// Certification slice
const certificationSlice = createSlice({
  name: 'certification',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCertifications.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchCertifications.fulfilled, (state, action: PayloadAction<Certification[]>) => {
        state.status = 'succeeded';
        state.certifications = action.payload;
      })
      .addCase(fetchCertifications.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to fetch certifications';
      })
      .addCase(addCertification.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(addCertification.fulfilled, (state, action: PayloadAction<Certification>) => {
        state.status = 'succeeded';
        state.certifications.push(action.payload);
      })
      .addCase(addCertification.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to add certification';
      })
      .addCase(updateCertification.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(updateCertification.fulfilled, (state, action: PayloadAction<Certification>) => {
        state.status = 'succeeded';
        const index = state.certifications.findIndex((cert) => cert.id === action.payload.id);
        if (index !== -1) {
          state.certifications[index] = action.payload;
        }
      })
      .addCase(updateCertification.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to update certification';
      })
      .addCase(deleteCertification.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(deleteCertification.fulfilled, (state, action: PayloadAction<string>) => {
        state.status = 'succeeded';
        state.certifications = state.certifications.filter((cert) => cert.id !== action.payload);
      })
      .addCase(deleteCertification.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.error.message || 'Failed to delete certification';
      });
  },
});

// Selectors
export const selectCertifications = (state: RootState) => state.certification.certifications;
export const selectCertificationStatus = (state: RootState) => state.certification.status;
export const selectCertificationError = (state: RootState) => state.certification.error;

export default certificationSlice.reducer;
