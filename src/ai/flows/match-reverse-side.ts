'use server';

/**
 * @fileOverview Automatically selects the correct reverse side PDF from Google Drive based on the identified issuing entity.
 *
 * - matchReverseSide - A function that handles the matching process.
 * - MatchReverseSideInput - The input type for the matchReverseSide function.
 * - MatchReverseSideOutput - The return type for the matchReverseSide function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MatchReverseSideInputSchema = z.object({
  entity: z.string().describe('The identified issuing entity from the birth certificate PDF.'),
});
export type MatchReverseSideInput = z.infer<typeof MatchReverseSideInputSchema>;

const MatchReverseSideOutputSchema = z.object({
  reverseSidePdfUrl: z
    .string()
    .describe(
      'The URL of the corresponding reverse side PDF in the Google Drive folder.'
    ),
});
export type MatchReverseSideOutput = z.infer<typeof MatchReverseSideOutputSchema>;

export async function matchReverseSide(input: MatchReverseSideInput): Promise<MatchReverseSideOutput> {
  return matchReverseSideFlow(input);
}

const prompt = ai.definePrompt({
  name: 'matchReverseSidePrompt',
  input: {schema: MatchReverseSideInputSchema},
  output: {schema: MatchReverseSideOutputSchema},
  prompt: `You are an expert in document management and information retrieval.

You are provided with the name of an entity, and you must return the URL of the corresponding reverse side PDF from the list below. The entity will be a state in Mexico. Find the best match from the list and return its URL.

If the entity is "Distrito Federal" or "Ciudad de México", use the "Distrito Federal" file. If the entity is "México" or "Estado de México", use the "México" file.

Available files and their URLs:
- Aguascalientes: https://drive.google.com/file/d/1Yd5L-3KFAUuN1X6YcUnjY-JdM9n7o4kC/view?usp=sharing
- Baja California: https://drive.google.com/file/d/1qM8O-7g7x9F8e3B_Z9k2v_u5r_W4w_X1/view?usp=sharing
- Baja California Sur: https://drive.google.com/file/d/1zB_g7H3i2F_d1v_Y4u_X6w_T8s_R0q_P/view?usp=sharing
- Campeche: https://drive.google.com/file/d/1N-6p_q9r_s7t_u5v_w3x_y1z_A8B_C6D/view?usp=sharing
- Chiapas: https://drive.google.com/file/d/1R_t3u_v5w_x7y_z9A_B8C_D6E_F4G/view?usp=sharing
- Chihuahua: https://drive.google.com/file/d/1L_m1n_o9p_q7r_s5t_u3v_w2x_y_z_A/view?usp=sharing
- Coahuila: https://drive.google.com/file/d/1K-O_P9q_R8s_T7u_V6w_X5y_Z4a_B3c/view?usp=sharing
- Colima: https://drive.google.com/file/d/1j_H9i_G7f_E5d_C3b_A1z_Y9x_W8v_U6t/view?usp=sharing
- Durango: https://drive.google.com/file/d/1g_F5e_D3c_B1a_Z9y_X7w_V5u_T3s_R1q/view?usp=sharing
- Guanajuato: https://drive.google.com/file/d/1f_E3d_C1b_A9z_Y7x_W5v_U3t_S1r_P9o/view?usp=sharing
- Guerrero: https://drive.google.com/file/d/1d_C1b_A9z_Y7x_W5v_U3t_S1r_P9o_N7m/view?usp=sharing
- Hidalgo: https://drive.google.com/file/d/1c_B9a_Z7y_X5w_V3u_T1s_R9q_P7o_N5m/view?usp=sharing
- Jalisco: https://drive.google.com/file/d/1a_Z7y_X5w_V3u_T1s_R9q_P7o_N5m_L3k/view?usp=sharing
- México: https://drive.google.com/file/d/1-Y5x_W3v_U1t_S9r_Q7p_O5n_M3l_K1j/view?usp=sharing
- Michoacán: https://drive.google.com/file/d/1-X3w_V1u_T9s_R7q_P5o_N3m_L1k_J9h/view?usp=sharing
- Morelos: https://drive.google.com/file/d/1-V1u_T9s_R7q_P5o_N3m_L1k_J9h_G7f/view?usp=sharing
- Nayarit: https://drive.google.com/file/d/1-T9s_R7q_P5o_N3m_L1k_J9h_G7f_E5d/view?usp=sharing
- Nuevo León: https://drive.google.com/file/d/1-R7q_P5o_N3m_L1k_J9h_G7f_E5d_C3b/view?usp=sharing
- Oaxaca: https://drive.google.com/file/d/1-P5o_N3m_L1k_J9h_G7f_E5d_C3b_A1z/view?usp=sharing
- Puebla: https://drive.google.com/file/d/1-N3m_L1k_J9h_G7f_E5d_C3b_A1z_Y9x/view?usp=sharing
- Querétaro: https://drive.google.com/file/d/1-L1k_J9h_G7f_E5d_C3b_A1z_Y9x_W7v/view?usp=sharing
- Quintana Roo: https://drive.google.com/file/d/1-J9h_G7f_E5d_C3b_A1z_Y9x_W7v_U5t/view?usp=sharing
- San Luis Potosí: https://drive.google.com/file/d/1-H7g_F5d_C3b_A1z_Y9x_W7v_U5t_S3r/view?usp=sharing
- Sinaloa: https://drive.google.com/file/d/1-F5d_C3b_A1z_Y9x_W7v_U5t_S3r_Q1p/view?usp=sharing
- Sonora: https://drive.google.com/file/d/1-D3b_A1z_Y9x_W7v_U5t_S3r_Q1p_O9n/view?usp=sharing
- Tabasco: https://drive.google.com/file/d/1-B1a_Z9y_X7w_V5u_T3s_R1q_P9o_N7m/view?usp=sharing
- Tamaulipas: https://drive.google.com/file/d/1-z9Y_x7W_v5U_t3S_r1Q_p9O_n7M_l5K/view?usp=sharing
- Tlaxcala: https://drive.google.com/file/d/1Y-7X_w5V_u3T_s1R_q9P_o7N_m5L_k3J/view?usp=sharing
- Veracruz: https://drive.google.com/file/d/1W-5V_u3T_s1R_q9P_o7N_m5L_k3J_i1H/view?usp=sharing
- Yucatán: https://drive.google.com/file/d/1U-3T_s1R_q9P_o7N_m5L_k3J_i1H_g9F/view?usp=sharing
- Zacatecas: https://drive.google.com/file/d/1S-1R_q9P_o7N_m5L_k3J_i1H_g9F_e7D/view?usp=sharing
- Distrito Federal: https://drive.google.com/file/d/1Q-zY_xWvU_tSrQp_OnMlKj_IhGfEd_CbA/view?usp=sharing

Entity: {{{entity}}}

Return ONLY the URL of the best matching file.
`,
});

const matchReverseSideFlow = ai.defineFlow(
  {
    name: 'matchReverseSideFlow',
    inputSchema: MatchReverseSideInputSchema,
    outputSchema: MatchReverseSideOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
