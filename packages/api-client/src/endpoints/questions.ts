import type { AnswerQuestionInput, AskQuestionInput, ProductCard, QuestionListQuery, QuestionView } from '@marketbd/shared';
import { baseApi, type Page, qs, unwrap, unwrapPage } from '../base-api.js';

/** Product Q&A (customers ask; sellers and admins answer) and "frequently bought together". */
export const questionsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    productQuestions: b.query<Page<QuestionView>, { productId: string } & QuestionListQuery>({
      query: ({ productId, ...params }) => `/products/${productId}/questions${qs(params)}`,
      transformResponse: unwrapPage<QuestionView>,
      providesTags: ['Questions'],
    }),
    askQuestion: b.mutation<QuestionView, { productId: string } & AskQuestionInput>({
      query: ({ productId, ...body }) => ({ url: `/products/${productId}/questions`, method: 'POST', body }),
      transformResponse: unwrap<QuestionView>,
      invalidatesTags: ['Questions'],
    }),
    /** Seller panel: questions on the seller's products. Admin: every question. */
    managedQuestions: b.query<Page<QuestionView>, { scope: 'seller' | 'admin' } & QuestionListQuery>({
      query: ({ scope, ...params }) => `/${scope}/questions${qs(params)}`,
      transformResponse: unwrapPage<QuestionView>,
      providesTags: ['Questions'],
    }),
    answerQuestion: b.mutation<QuestionView, { scope: 'seller' | 'admin'; id: string } & AnswerQuestionInput>({
      query: ({ scope, id, ...body }) => ({ url: `/${scope}/questions/${id}/answer`, method: 'PATCH', body }),
      transformResponse: unwrap<QuestionView>,
      invalidatesTags: ['Questions'],
    }),
    moderateQuestion: b.mutation<QuestionView, { id: string; isVisible: boolean }>({
      query: ({ id, isVisible }) => ({ url: `/admin/questions/${id}`, method: 'PATCH', body: { isVisible } }),
      transformResponse: unwrap<QuestionView>,
      invalidatesTags: ['Questions'],
    }),
    boughtTogether: b.query<ProductCard[], string>({
      query: (slug) => `/products/${slug}/bought-together`,
      transformResponse: unwrap<ProductCard[]>,
      providesTags: ['Products'],
    }),
  }),
});

export const {
  useProductQuestionsQuery,
  useAskQuestionMutation,
  useManagedQuestionsQuery,
  useAnswerQuestionMutation,
  useModerateQuestionMutation,
  useBoughtTogetherQuery,
} = questionsApi;
