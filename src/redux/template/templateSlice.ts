import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../store';

export interface Template {
  id: string;
  name: string;
  type: 'CV' | 'COVER_LETTER';
  templateFile: string;
  createdAt: string;
  plan?: "FREE" | "PAID"
}

interface TemplateState {
  templates: Template[];
  template: Template | null;
  loading: boolean;
  error: string | null;
}

const initialState: TemplateState = {
  templates: [],
  template: null,
  loading: false,
  error: null,
};

// 🎯 API URL (à adapter à ton backend)
const API_URL = '/api/templates';

// 🟢 Thunk pour récupérer les templates
export const fetchTemplates = createAsyncThunk('template/fetchTemplates', async (_, thunkAPI) => {
  try {
    const response = await axios.get<Template[]>(API_URL);
    return response.data;
  } catch (error: any) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Erreur lors du chargement');
  }
});

// 🟢 Thunk pour récupérer les templates
export const fetchTemplate = createAsyncThunk('template/fetchTemplate', async ({id}:{id: string}, thunkAPI) => {
  try {
    const response = await axios.get<Template>(`${API_URL}/${id}`);
    return response.data;
  } catch (error: any) {
    return thunkAPI.rejectWithValue(error.response?.data?.message || 'Erreur lors du chargement');
  }
});

// 🟢 Thunk pour ajouter un template
export const addTemplate = createAsyncThunk(
  'template/addTemplate',
  async (formData: FormData, thunkAPI) => {
    try {
      const response = await axios.post<Template>(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    } catch (error: any) {
      return thunkAPI.rejectWithValue(error.response?.data?.message || 'Erreur lors de l’ajout');
    }
  }
);

export const updateTemplatePlan = createAsyncThunk("template/updateTemplatePlan", async ({ id, plan }: { id: string, plan: string }, { rejectWithValue }) => {
  let url = `${API_URL}/${id}/updateplan`
  try {
    const response = await axios.put(url, { id, plan });
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return rejectWithValue(error.response?.data || "Erreur inconnue");
    }
    return rejectWithValue("Erreur inconnue");
  }
})

const templateSlice = createSlice({
  name: 'template',
  initialState,
  reducers: {
    // Si tu veux des actions sync plus tard
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTemplates.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTemplates.fulfilled, (state, action: PayloadAction<Template[]>) => {
        state.loading = false;
        state.templates = action.payload;
      })
      .addCase(fetchTemplates.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(fetchTemplate.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTemplate.fulfilled, (state, action: PayloadAction<Template>) => {
        state.loading = false;
        state.template = action.payload;
      })
      .addCase(fetchTemplate.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      .addCase(addTemplate.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addTemplate.fulfilled, (state, action: PayloadAction<Template>) => {
        state.loading = false;
        state.templates.push(action.payload);
      })
      .addCase(addTemplate.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const selectTemplate = (state: RootState) => state.template.template 

export default templateSlice.reducer;
