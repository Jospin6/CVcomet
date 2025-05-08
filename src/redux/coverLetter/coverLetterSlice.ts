import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit'
import { RootState } from '../store'
import axios from 'axios'
import { User } from '../user/userSlice'

export interface CoverLetter {
    id?: string
    title: string
    content: string
    company?: string
    jobTitle?: string
    location?: string
    userId: string
    cvId?: string
    createdAt?: string
    updatedAt?: string
}

export const generateCoverLetter = createAsyncThunk(
    "coverLetter/generateCoverLetter", 
    async ({ description, user }: { description: string, user: User }, { rejectWithValue }) => {
    try {
        const res = await axios.post('/api/generate-cover-letter', { description, user })

        return res.data
    } catch (error: any) {
        return rejectWithValue(error.message || 'Erreur inconnue')
    }

})

export const fetchCoverLetter = createAsyncThunk(
    "coverLetter/fetchCoverLetter", 
    async () => {
    let url = "/api/coverLetter";
    try {
        const res = await axios.get(url)

        return res.data
    } catch (error: any) {
        throw new Error(error.message || 'Erreur inconnue')
    }
})

interface CoverLetterState {
    letters: CoverLetter[]
    letter: CoverLetter | null
    loading: boolean
    error: string | null
}

const initialState: CoverLetterState = {
    letters: [],
    letter: null,
    loading: false,
    error: null,
}

const coverLetterSlice = createSlice({
    name: 'coverLetter',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(generateCoverLetter.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(generateCoverLetter.fulfilled, (state, action: PayloadAction<CoverLetter>) => {
                state.letter = action.payload
                state.loading = false
            })
            .addCase(generateCoverLetter.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload as string
            })

            .addCase(fetchCoverLetter.pending, (state) => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchCoverLetter.fulfilled, (state, action: PayloadAction<CoverLetter[]>) => {
                state.letters = action.payload
                state.loading = false
            })
            .addCase(fetchCoverLetter.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload as string
            })
    },
})

export const selectCoverLetterState = (state: RootState) => state.coverLetter

export default coverLetterSlice.reducer
