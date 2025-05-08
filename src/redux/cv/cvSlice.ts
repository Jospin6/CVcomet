import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import { RootState } from '../store'
import axios from 'axios'
import { User } from '../user/userSlice'

export interface Cv {
    id?: string
    title: string
    summary: string[]
    skills?: any
    experiences?: any
    educations?: any
    certifications?: any
    projects?: any
    languages?: any
    createdAt?: string
    userId: string
}


export const generateCv = createAsyncThunk(
    "cv/generateCv",
    async ({ description, user }: { description: string, user?: User }, { rejectWithValue }) => {
        try {
            const res = await axios.post('/api/generate-cv', { description})
            console.log("CV RESPONSE", res.data)

            return res.data
        } catch (error: any) {
            return rejectWithValue(error.message || 'Erreur inconnue')
        }
    })

export const fetchCvs = createAsyncThunk(
    "cv/fetchCvs",
    async () => {
        let url = "/api/cvs";
        try {
            const res = await axios.get(url)

            return res.data
        } catch (error: any) {
            return rejectWithValue(error.message || 'Erreur inconnue')
        }
    })

interface CvState {
    cvs: Cv[]
    cv: Cv | null,
    loading: boolean
    error: string | null
}

const initialState: CvState = {
    cvs: [],
    cv: null,
    loading: false,
    error: null,
}

const cvSlice = createSlice({
    name: 'cv',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(generateCv.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(generateCv.fulfilled, (state, action: PayloadAction<Cv>) => {
                state.cv = action.payload
                state.loading = false
            })
            .addCase(generateCv.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload as string
            })

            .addCase(fetchCvs.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchCvs.fulfilled, (state, action: PayloadAction<Cv[]>) => {
                state.cvs = action.payload
                state.loading = false
            })
            .addCase(fetchCvs.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload as string
            })
    },
})

export const selectCvState = (state: RootState) => state.cv

export default cvSlice.reducer
function rejectWithValue(arg0: any): any {
    throw new Error('Function not implemented.')
}

