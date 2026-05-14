/** Hora inicial da grelha (vista dia/semana). */
export const LEX_AGENDA_GRID_START_H = 0;
/** Hora final da grelha (vista dia/semana). */
export const LEX_AGENDA_GRID_END_H = 23;
/** Altura de cada hora na grelha (px). */
export const LEX_AGENDA_PX_PER_H = 40;
/** Largura da coluna de horários na vista semana. */
export const LEX_AGENDA_WEEK_TIME_COL_PX = 72;

export const LEX_AGENDA_MONTH_WEEK_HDR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/**
 * Mês: `l` em todas as células (uma linha vertical por junção); `t` topo; `r` coluna 6; `b` última fila.
 * Semana (slots hora): `b` — só `border-bottom` por faixa.
 */
export const LEX_AGENDA_GRID_LINE_L = "lex-agenda-grid-line-l";
export const LEX_AGENDA_GRID_LINE_T = "lex-agenda-grid-line-t";
export const LEX_AGENDA_GRID_LINE_R = "lex-agenda-grid-line-r";
export const LEX_AGENDA_GRID_LINE_H_SOFT = "lex-agenda-grid-line-b";
export const LEX_AGENDA_GRID_LINE_H_HEADER = "lex-agenda-grid-line-b-header";
