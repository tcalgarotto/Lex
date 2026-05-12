"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatCnj } from "@/lib/cnj";
import type { InputProps } from "@/components/ui/input";

/**
 * Campo CNJ com formatação no blur — precisa ser Client Component
 * porque Server Components não aceitam event handlers (`onBlur`).
 */
export function CnjInput({ onBlur, ...props }: InputProps) {
 return (
 <Input
 {...props}
 onBlur={(e) => {
 e.currentTarget.value = formatCnj(e.currentTarget.value);
 onBlur?.(e);
 }}
 />
 );
}
