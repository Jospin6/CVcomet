import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { RootState } from '../store';
import { CoverLetterProps, CvProps } from '@/helpers/schema';

export interface Conversation {
    id?: string;
    content: string;
    userId: string;
    Cv?: CvProps[];
    CoverLetter?: CoverLetterProps[];
    createdAt?: string;
    updatedAt?: string;
}

interface ConversationState {
    conversations: Conversation[];
    currentConversation?: Conversation | null;
    currentConversationId?: string | null;
    typeGeneration?: "cv" | "coverLetter" | null;
    loading: boolean;
    error: string | null;
}

const initialState: ConversationState = {
    conversations: [],
    currentConversation: null,
    typeGeneration: null,
    currentConversationId: null,
    loading: false,
    error: null,
};

// ✅ GET /api/conversation
export const fetchConversations = createAsyncThunk<Conversation[], { userId: string }, { rejectValue: string }>(
    'conversation/fetchConversations',
    async ({ userId }, { rejectWithValue }) => {
        try {
            let url = "/api/conversations";
            const params = new URLSearchParams();
            if (userId) params.append("userId", String(userId));
            if (params.toString()) {
                url += `?${params.toString()}`;
            }
            const res = await axios.get(url)
            return await res.data;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Unknown error');
        }
    }
);

// ✅ POST /api/conversation
export const addConversation = createAsyncThunk<Conversation, Partial<Conversation>, { rejectValue: string }>(
    'conversation/addConversation',
    async (newConversation, { rejectWithValue }) => {
        try {
            const res = await axios.post('/api/conversations', newConversation)
            return await res.data;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Unknown error');
        }
    }
);

// ✅ POST /api/conversations/:id
export const getConversation = createAsyncThunk<Conversation, { id: string }, { rejectValue: string }>(
    'conversation/getConversation',
    async ({ id }: { id: string }, { rejectWithValue }) => {
        try {
            const res = await axios.get(`/api/conversations/${id}`);
            return await res.data;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Unknown error');
        }
    }
);

// ✅ PUT /api/conversation/:id
// export const updateConversation = createAsyncThunk<Conversation, Conversation, { rejectValue: string }>(
//   'conversation/updateConversation',
//   async (conversation, { rejectWithValue }) => {
//     try {
//       const res = await fetch(`/api/conversation/${conversation.id}`, {
//         method: 'PUT',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(conversation),
//       });
//       if (!res.ok) throw new Error('Failed to update conversation');
//       return await res.json();
//     } catch (err: any) {
//       return rejectWithValue(err.message || 'Unknown error');
//     }
//   }
// );

// ✅ DELETE /api/conversation/:id
export const deleteConversation = createAsyncThunk<string, string, { rejectValue: string }>(
    'conversation/deleteConversation',
    async (id, { rejectWithValue }) => {
        try {
            const res = await axios.delete(`/api/conversations/${id}`)
            return res.data.id;
        } catch (err: any) {
            return rejectWithValue(err.message || 'Unknown error');
        }
    }
);

const conversationSlice = createSlice({
    name: 'conversation',
    initialState,
    reducers: {
        setCurrentConversation: (state, action: PayloadAction<Conversation | null>) => {
            state.currentConversation = action.payload;
            state.currentConversationId = action.payload ? action.payload.id : null;
        },
        setTypeGeneration: (state, action: PayloadAction<"cv" | "coverLetter" | null>) => {
            state.typeGeneration = action.payload;
        },
        clearConversations: (state) => {
            state.conversations = [];
            state.currentConversation = null;
            state.currentConversationId = null;
        },
        clearConversationId: (state) => {
            state.currentConversationId = null;
        },
        clearError: (state) => {
            state.error = null;
        },
        clearLoading: (state) => {
            state.loading = false;
        }
    },
    extraReducers: (builder) => {
        // fetch
        builder.addCase(fetchConversations.pending, (state) => {
            state.loading = true;
            state.error = null;
        });
        builder.addCase(fetchConversations.fulfilled, (state, action) => {
            state.conversations = action.payload;
            state.loading = false;
        });
        builder.addCase(fetchConversations.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload || 'Failed to fetch conversations';
        });

        // get
        builder.addCase(getConversation.pending, (state) => {
            state.loading = true;
            state.error = null;
        });
        builder.addCase(getConversation.fulfilled, (state, action: PayloadAction<Conversation>) => {
            state.currentConversation = action.payload;
            state.loading = false;
        });
        builder.addCase(getConversation.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload || 'Failed to fetch conversations';
        });

        // add
        builder.addCase(addConversation.fulfilled, (state, action) => {
            state.conversations.push(action.payload);
            state.currentConversation = action.payload;
            state.currentConversationId = action.payload.id
        });
        builder.addCase(addConversation.rejected, (state, action) => {
            state.error = action.payload || 'Failed to add conversation';
        });

        // delete
        builder.addCase(deleteConversation.fulfilled, (state, action) => {
            state.conversations = state.conversations.filter(c => c.id !== action.payload);
        });
        builder.addCase(deleteConversation.rejected, (state, action) => {
            state.error = action.payload || 'Failed to delete conversation';
        });
    },
});


export const selectConversation = (state: RootState) => state.conversation.currentConversation;
export const selectConversationId = (state: RootState) => state.conversation.currentConversationId;
export const selectTypeGeneration = (state: RootState) => state.conversation.typeGeneration;

export const { setCurrentConversation, setTypeGeneration, clearConversationId } = conversationSlice.actions
export default conversationSlice.reducer;
