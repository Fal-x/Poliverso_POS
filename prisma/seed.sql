--
-- PostgreSQL database dump
--

\restrict TkXZPt3YH1ERGVqvPpXUHbDnQ78mE69c0PGok9mBbchGLajnotsPc6SrPujzaWQ

-- Dumped from database version 16.11 (Homebrew)
-- Dumped by pg_dump version 16.11 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: Organization; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Organization" (id, name, "createdAt", "updatedAt", "legalName", nit, phone, address, city) VALUES ('3c73d48b-57b5-46c1-959c-99322b06adf8', 'POLIVERSE - POLIVALENTE', '2026-02-20 20:14:36.343-05', '2026-02-20 20:14:55.845-05', 'POLIVERSE S.A.S.', '901234567-8', '6041234567', 'Cra 1 # 2-03', 'Montelíbano');


--
-- Data for Name: Site; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Site" (id, "organizationId", name, code, status, timezone, "createdAt", "updatedAt", address, city, phone, "defaultCustomerId") VALUES ('a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '3c73d48b-57b5-46c1-959c-99322b06adf8', 'POLIVERSE MallBP Montelíbano', 'MLBP-MONTELIBANO', 'ACTIVE', 'America/Bogota', '2026-02-20 20:14:36.357-05', '2026-02-20 20:14:58.302-05', 'Centro Comercial MallBP', 'Montelíbano', '6041234567', '8f85da84-2d29-4e13-9b83-ddbf5f6e8bea');


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."User" (id, email, "fullName", "passwordHash", status, "createdAt", "updatedAt") VALUES ('0b2b574d-5cbf-4afd-a91d-931c8e31a654', 'admin@poliverse.local', 'Admin POLIVERSE', '$2a$10$PxWYbVFLW.E9bBBG/8VkYeUcU5bQKaCAbbk5eoIQ2rtENlamweQNm', 'ACTIVE', '2026-02-20 20:14:36.498-05', '2026-02-20 20:14:55.998-05');
INSERT INTO public."User" (id, email, "fullName", "passwordHash", status, "createdAt", "updatedAt") VALUES ('402d5332-87ec-47a4-a675-3adc1279dbab', 'supervisor@poliverse.local', 'Supervisor Turno', '$2a$10$wqYNE3PudXZBlvdWX8EmGuRVtj/0BF789ROzGrOMkTxZGkFspGriW', 'ACTIVE', '2026-02-20 20:14:36.572-05', '2026-02-20 20:14:56.069-05');
INSERT INTO public."User" (id, email, "fullName", "passwordHash", status, "createdAt", "updatedAt") VALUES ('5375c31e-ccf5-42d8-a035-8ff51594a36e', 'cajero1@poliverse.local', 'Cajero 1', '$2a$10$10FyzBkMFPSCuOK6XvB6lerG8TFcuyFhzEYKtMmqjGFrKbz/DrYO6', 'ACTIVE', '2026-02-20 20:14:36.642-05', '2026-02-20 20:14:56.141-05');
INSERT INTO public."User" (id, email, "fullName", "passwordHash", status, "createdAt", "updatedAt") VALUES ('514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'cajero2@poliverse.local', 'Cajero 2', '$2a$10$m.bTFiixT4ScykTVJUKuG.r2Ez3ru1PiYC6bKXvBnTsDGnVgIg40.', 'ACTIVE', '2026-02-20 20:14:36.713-05', '2026-02-20 20:14:56.212-05');


--
-- Data for Name: SupervisorApproval; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."SupervisorApproval" (id, "siteId", action, "entityType", "entityId", "requestedById", "approvedById", reason, "createdAt") VALUES ('191a0cfb-93ef-4e20-b61f-e7900a63ddf9', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'VOID_SALE', 'SALE', '7a95da5f-081d-46a7-862a-dac1ceb3a731', '5375c31e-ccf5-42d8-a035-8ff51594a36e', '402d5332-87ec-47a4-a675-3adc1279dbab', 'Cliente desistió inmediatamente', '2026-02-19 21:17:58.35-05');
INSERT INTO public."SupervisorApproval" (id, "siteId", action, "entityType", "entityId", "requestedById", "approvedById", reason, "createdAt") VALUES ('8e884057-fcff-429e-805e-1b5dee254b26', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'CASH_WITHDRAWAL', 'SHIFT', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', '402d5332-87ec-47a4-a675-3adc1279dbab', 'Bajar efectivo en caja', '2026-02-20 19:44:58.362-05');
INSERT INTO public."SupervisorApproval" (id, "siteId", action, "entityType", "entityId", "requestedById", "approvedById", reason, "createdAt") VALUES ('e16f36dc-7bba-41de-8eae-d109b7cebd93', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'OTHER', 'OTHER', 'PRIZE-95a3e9d1-c427-44cb-8f9b-af8cdd220bb1', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', '402d5332-87ec-47a4-a675-3adc1279dbab', 'Redención premio seed', '2026-02-20 20:14:58.366-05');
INSERT INTO public."SupervisorApproval" (id, "siteId", action, "entityType", "entityId", "requestedById", "approvedById", reason, "createdAt") VALUES ('aaf74ef0-b4b0-4cc0-95b5-9d12bae2649f', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'REVERSE_ATTRACTION', 'ATTRACTION_USAGE', '1', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', '402d5332-87ec-47a4-a675-3adc1279dbab', 'Doble lectura detectada', '2026-02-20 20:14:58.379-05');


--
-- Data for Name: AdminAction; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Attraction; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('9feeaf10-7a07-4de7-a2a6-df3fbaa5a5fe', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Arcade 01', 'ARCADE-01', 4000.00, true, '2026-02-20 20:14:37.085-05', 4);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('99c7fbc3-4056-4cd1-9a93-06c471f383fb', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Arcade 02', 'ARCADE-02', 4000.00, true, '2026-02-20 20:14:37.164-05', 4);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('56a83ffa-4c62-4978-b41d-a9c8cd70ea32', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Arcade 03', 'ARCADE-03', 4000.00, true, '2026-02-20 20:14:37.236-05', 4);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('faa6e18f-399c-493a-b48b-c05a97740849', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Arcade 04', 'ARCADE-04', 4000.00, true, '2026-02-20 20:14:37.38-05', 4);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('93b4256c-24a1-47cc-ac13-15a6f8da55fa', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Arcade 05', 'ARCADE-05', 4000.00, true, '2026-02-20 20:14:37.522-05', 4);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('9c1422ef-048b-4711-8a2c-942eb8f40e5d', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Arcade 06', 'ARCADE-06', 4000.00, true, '2026-02-20 20:14:37.664-05', 4);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('c33d215e-c693-4992-b989-1d738a10a18d', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Arcade 07', 'ARCADE-07', 4000.00, true, '2026-02-20 20:14:37.806-05', 4);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('eb091407-b4a2-44ac-add4-c8d798d19d20', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Arcade 08', 'ARCADE-08', 4000.00, true, '2026-02-20 20:14:37.881-05', 4);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('a702b03f-7650-4798-a428-5f95251ade47', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Arcade 09', 'ARCADE-09', 4000.00, true, '2026-02-20 20:14:37.958-05', 4);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('97b20337-d80b-4f71-b7f9-88bdef02ca45', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Arcade 10', 'ARCADE-10', 4000.00, true, '2026-02-20 20:14:38.033-05', 4);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('52a6439e-ec4b-474a-a5e7-280a679e678f', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Arcade 11', 'ARCADE-11', 4000.00, true, '2026-02-20 20:14:38.109-05', 4);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('812fb053-b7be-4a11-ba0e-437f9d89d5a3', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Playground 2 a 6', 'PLAY-2-6', 8000.00, true, '2026-02-20 20:14:38.184-05', 8);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('c8bebee9-9ef2-48c6-8dd4-6e3faafe4990', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Playground 6 a 12', 'PLAY-6-12', 10000.00, true, '2026-02-20 20:14:38.259-05', 10);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('8cd9b82a-e455-4e46-b5aa-9d0f201eba45', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Realidad Virtual 1', 'VR-01', 12000.00, true, '2026-02-20 20:14:38.331-05', 12);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('cc8ddcf3-71d9-4ba1-aa01-10f9a71da39f', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Realidad Virtual 2', 'VR-02', 12000.00, true, '2026-02-20 20:14:38.405-05', 12);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('b4804741-386b-46fa-9826-a4b5f341cc33', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Zona Polirobotics', 'POLIROBO', 15000.00, true, '2026-02-20 20:14:38.475-05', 15);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('e0a8c2c7-baba-412a-bcf5-9865f2fddddb', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Atracción Extra 01', 'EXTRA-01', 5000.00, true, '2026-02-20 20:14:38.546-05', 5);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('47cdd65d-03ea-4122-bbe1-257871a73b57', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Atracción Extra 02', 'EXTRA-02', 5000.00, true, '2026-02-20 20:14:38.618-05', 5);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('f432940b-92fe-4034-896a-8340d9a6b282', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Atracción Extra 03', 'EXTRA-03', 7000.00, true, '2026-02-20 20:14:38.688-05', 7);
INSERT INTO public."Attraction" (id, "siteId", name, code, cost, "isActive", "createdAt", "costPoints") VALUES ('5c77d432-0ba2-43ed-8d97-389e2b13bf7c', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Atracción Extra 04', 'EXTRA-04', 7000.00, true, '2026-02-20 20:14:38.759-05', 7);


--
-- Data for Name: Card; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Card" (id, "siteId", uid, status, "issuedAt") VALUES ('a8cd692a-3532-4647-b0e7-8fdec16f415b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '04A1B2C3D4', 'ACTIVE', '2026-02-17 20:14:38.829-05');
INSERT INTO public."Card" (id, "siteId", uid, status, "issuedAt") VALUES ('1b95af6c-ade7-4a28-b767-c722e7d8ccc3', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '04A1B2C3D5', 'ACTIVE', '2026-02-17 20:14:38.833-05');
INSERT INTO public."Card" (id, "siteId", uid, status, "issuedAt") VALUES ('f9f03da8-d524-42c0-b619-a87a5e81e955', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '04A1B2C3D6', 'LOST', '2026-02-17 20:14:38.833-05');
INSERT INTO public."Card" (id, "siteId", uid, status, "issuedAt") VALUES ('dc610dcd-8dff-4634-8e52-0e1cd87ff5b8', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '04A1B2C3D7', 'BLOCKED', '2026-02-17 20:14:38.834-05');
INSERT INTO public."Card" (id, "siteId", uid, status, "issuedAt") VALUES ('bf15a0cd-b819-4bc6-8fc6-3fa366c6fc9b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '04A1B2C3D8', 'ACTIVE', '2026-02-17 20:14:38.835-05');
INSERT INTO public."Card" (id, "siteId", uid, status, "issuedAt") VALUES ('167f25c7-2b59-403a-950b-d7c7b5fdcc95', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '04A1B2C3D9', 'ACTIVE', '2026-02-17 20:14:38.835-05');


--
-- Data for Name: CashRegister; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."CashRegister" (id, "siteId", code, name, "createdAt") VALUES ('2133fc59-1994-45cf-ae32-3e0507461bd9', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'CR-01', 'Caja 1', '2026-02-20 20:14:37.013-05');
INSERT INTO public."CashRegister" (id, "siteId", code, name, "createdAt") VALUES ('3c8d3fe0-378f-45c6-a0ca-388ec7b7fe3b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'CR-02', 'Caja 2', '2026-02-20 20:14:37.015-05');


--
-- Data for Name: Terminal; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Terminal" (id, "siteId", code, name, "createdAt") VALUES ('b0955e24-b84a-4c54-8f11-761630059512', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'T-01', 'Terminal Taquilla 1', '2026-02-20 20:14:37.01-05');
INSERT INTO public."Terminal" (id, "siteId", code, name, "createdAt") VALUES ('c3a218a0-bead-452f-9cc7-af375f3895e8', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'T-02', 'Terminal Taquilla 2', '2026-02-20 20:14:37.012-05');


--
-- Data for Name: Shift; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Shift" (id, "siteId", "cashRegisterId", "terminalId", "openedById", "openedAt", "openingCash", status, "closedById", "closedAt", "expectedCash", "countedCash", "cashDiscrepancy", notes) VALUES ('c9dcb2cd-5981-4217-bb91-686acd9a95b6', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '2133fc59-1994-45cf-ae32-3e0507461bd9', 'b0955e24-b84a-4c54-8f11-761630059512', '5375c31e-ccf5-42d8-a035-8ff51594a36e', '2026-02-19 20:14:37.06-05', 200000.00, 'CLOSED', '402d5332-87ec-47a4-a675-3adc1279dbab', '2026-02-20 04:14:37.06-05', 520000.00, 518000.00, -2000.00, 'Cierre de prueba con descuadre leve');
INSERT INTO public."Shift" (id, "siteId", "cashRegisterId", "terminalId", "openedById", "openedAt", "openingCash", status, "closedById", "closedAt", "expectedCash", "countedCash", "cashDiscrepancy", notes) VALUES ('9c2b5d7f-b758-48c2-95f6-9e0767067d81', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '3c8d3fe0-378f-45c6-a0ca-388ec7b7fe3b', 'c3a218a0-bead-452f-9cc7-af375f3895e8', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', '2026-02-20 20:14:37.065-05', 150000.00, 'CLOSED', '402d5332-87ec-47a4-a675-3adc1279dbab', '2026-02-20 20:14:37.065-05', 150000.00, 150000.00, 0.00, 'Turno seed (cerrado para demo)');
INSERT INTO public."Shift" (id, "siteId", "cashRegisterId", "terminalId", "openedById", "openedAt", "openingCash", status, "closedById", "closedAt", "expectedCash", "countedCash", "cashDiscrepancy", notes) VALUES ('33abe9ce-fe90-4267-b1f3-14c95cd9cdee', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '2133fc59-1994-45cf-ae32-3e0507461bd9', 'b0955e24-b84a-4c54-8f11-761630059512', '5375c31e-ccf5-42d8-a035-8ff51594a36e', '2026-02-19 20:14:56.538-05', 200000.00, 'CLOSED', '402d5332-87ec-47a4-a675-3adc1279dbab', '2026-02-20 04:14:56.538-05', 520000.00, 518000.00, -2000.00, 'Cierre de prueba con descuadre leve');
INSERT INTO public."Shift" (id, "siteId", "cashRegisterId", "terminalId", "openedById", "openedAt", "openingCash", status, "closedById", "closedAt", "expectedCash", "countedCash", "cashDiscrepancy", notes) VALUES ('0f872e16-361d-4354-b1e9-f48f1d7cc0aa', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '3c8d3fe0-378f-45c6-a0ca-388ec7b7fe3b', 'c3a218a0-bead-452f-9cc7-af375f3895e8', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', '2026-02-20 20:14:56.543-05', 150000.00, 'CLOSED', '402d5332-87ec-47a4-a675-3adc1279dbab', '2026-02-20 20:14:56.543-05', 150000.00, 150000.00, 0.00, 'Turno seed (cerrado para demo)');
INSERT INTO public."Shift" (id, "siteId", "cashRegisterId", "terminalId", "openedById", "openedAt", "openingCash", status, "closedById", "closedAt", "expectedCash", "countedCash", "cashDiscrepancy", notes) VALUES ('8e7c3719-cec2-49da-b3ec-520ed60b7884', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '2133fc59-1994-45cf-ae32-3e0507461bd9', 'b0955e24-b84a-4c54-8f11-761630059512', '5375c31e-ccf5-42d8-a035-8ff51594a36e', '2026-02-17 20:14:58.393-05', 100000.00, 'RECONCILED', '402d5332-87ec-47a4-a675-3adc1279dbab', '2026-02-18 05:14:58.393-05', 300000.00, 300000.00, 0.00, 'Turno conciliado seed');


--
-- Data for Name: CashSession; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."CashSession" (id, "siteId", "terminalId", "cashRegisterId", "shiftId", "openedByUserId", "openedAt", "openingCashAmount", "expectedCashAmount", "closedAt", "closingCashAmount", "cashDifference", "closeReason", status, "openedApprovalId", "closedApprovalId", "closedById") VALUES ('33f2c741-209e-41a0-abda-15d0670f0ac0', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'b0955e24-b84a-4c54-8f11-761630059512', '2133fc59-1994-45cf-ae32-3e0507461bd9', 'c9dcb2cd-5981-4217-bb91-686acd9a95b6', '5375c31e-ccf5-42d8-a035-8ff51594a36e', '2026-02-19 20:14:37.06-05', 200000.00, 520000.00, '2026-02-20 04:14:37.06-05', 518000.00, -2000.00, 'Descuadre leve en cierre', 'CLOSED', NULL, NULL, '402d5332-87ec-47a4-a675-3adc1279dbab');
INSERT INTO public."CashSession" (id, "siteId", "terminalId", "cashRegisterId", "shiftId", "openedByUserId", "openedAt", "openingCashAmount", "expectedCashAmount", "closedAt", "closingCashAmount", "cashDifference", "closeReason", status, "openedApprovalId", "closedApprovalId", "closedById") VALUES ('904c9840-e259-4690-afe4-f88ee0eb1ea6', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'c3a218a0-bead-452f-9cc7-af375f3895e8', '3c8d3fe0-378f-45c6-a0ca-388ec7b7fe3b', '9c2b5d7f-b758-48c2-95f6-9e0767067d81', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', '2026-02-20 20:14:37.065-05', 150000.00, 150000.00, '2026-02-20 20:14:37.076-05', 150000.00, 0.00, 'Cierre seed para evitar conflicto', 'CLOSED', NULL, NULL, '402d5332-87ec-47a4-a675-3adc1279dbab');
INSERT INTO public."CashSession" (id, "siteId", "terminalId", "cashRegisterId", "shiftId", "openedByUserId", "openedAt", "openingCashAmount", "expectedCashAmount", "closedAt", "closingCashAmount", "cashDifference", "closeReason", status, "openedApprovalId", "closedApprovalId", "closedById") VALUES ('90e5e99a-1815-41e6-bb3e-b453fed1ae38', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'b0955e24-b84a-4c54-8f11-761630059512', '2133fc59-1994-45cf-ae32-3e0507461bd9', '33abe9ce-fe90-4267-b1f3-14c95cd9cdee', '5375c31e-ccf5-42d8-a035-8ff51594a36e', '2026-02-19 20:14:56.538-05', 200000.00, 520000.00, '2026-02-20 04:14:56.538-05', 518000.00, -2000.00, 'Descuadre leve en cierre', 'CLOSED', NULL, NULL, '402d5332-87ec-47a4-a675-3adc1279dbab');
INSERT INTO public."CashSession" (id, "siteId", "terminalId", "cashRegisterId", "shiftId", "openedByUserId", "openedAt", "openingCashAmount", "expectedCashAmount", "closedAt", "closingCashAmount", "cashDifference", "closeReason", status, "openedApprovalId", "closedApprovalId", "closedById") VALUES ('3072b5ea-692a-423d-b8b9-7a000c8699f1', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'c3a218a0-bead-452f-9cc7-af375f3895e8', '3c8d3fe0-378f-45c6-a0ca-388ec7b7fe3b', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', '2026-02-20 20:14:56.543-05', 150000.00, 150000.00, '2026-02-20 20:14:56.551-05', 150000.00, 0.00, 'Cierre seed para evitar conflicto', 'CLOSED', NULL, NULL, '402d5332-87ec-47a4-a675-3adc1279dbab');


--
-- Data for Name: Customer; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Customer" (id, "fullName", email, phone, "createdAt", "updatedAt", "siteId", "documentType", "documentNumber", city, notes) VALUES ('8f85da84-2d29-4e13-9b83-ddbf5f6e8bea', 'CONSUMIDOR FINAL', NULL, '0000000000', '2026-02-20 20:14:38.837-05', '2026-02-20 20:14:58.3-05', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'NIT', '222222222', 'Montelíbano', 'Cliente genérico para ventas rápidas.');
INSERT INTO public."Customer" (id, "fullName", email, phone, "createdAt", "updatedAt", "siteId", "documentType", "documentNumber", city, notes) VALUES ('00000000-0000-0000-0000-000000000001', 'Ana María Pérez', 'ana@example.com', '3001234567', '2026-02-20 20:14:38.845-05', '2026-02-20 20:14:58.305-05', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'CC', '1032456789', 'Montelíbano', 'Cliente frecuente.');
INSERT INTO public."Customer" (id, "fullName", email, phone, "createdAt", "updatedAt", "siteId", "documentType", "documentNumber", city, notes) VALUES ('06ba86ee-14f0-44c2-9e1f-8203ce65c9df', 'Luis García', 'luis@example.com', '3017654321', '2026-02-20 20:14:38.846-05', '2026-02-20 20:14:58.307-05', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'CE', '203456789', 'Montería', NULL);


--
-- Data for Name: Sale; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Sale" (id, "siteId", "shiftId", "terminalId", status, subtotal, tax, total, "requiresElectronicInvoice", "electronicInvoiceNumber", "electronicInvoiceCode", "createdById", "approvedById", "approvedAt", "createdAt", "voidedAt", "cashSessionId", "customerId", "totalPaid", "balanceDue", "bonusTotal", "pointsEarned", "receiptNumber", "receiptText", "paidAt") VALUES ('751c8497-e8f0-4c1f-9d39-b9f0f62f324d', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '9c2b5d7f-b758-48c2-95f6-9e0767067d81', 'c3a218a0-bead-452f-9cc7-af375f3895e8', 'PAID', 53000.00, 0.00, 53000.00, true, NULL, NULL, '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', NULL, NULL, '2026-02-20 20:14:38.869-05', NULL, '904c9840-e259-4690-afe4-f88ee0eb1ea6', '00000000-0000-0000-0000-000000000001', 55000.00, -2000.00, 15000.00, 50, NULL, NULL, '2026-02-20 20:14:38.869-05');
INSERT INTO public."Sale" (id, "siteId", "shiftId", "terminalId", status, subtotal, tax, total, "requiresElectronicInvoice", "electronicInvoiceNumber", "electronicInvoiceCode", "createdById", "approvedById", "approvedAt", "createdAt", "voidedAt", "cashSessionId", "customerId", "totalPaid", "balanceDue", "bonusTotal", "pointsEarned", "receiptNumber", "receiptText", "paidAt") VALUES ('7ee7993c-ed83-4925-b938-563455fa88f1', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '9c2b5d7f-b758-48c2-95f6-9e0767067d81', 'c3a218a0-bead-452f-9cc7-af375f3895e8', 'PAID', 58000.00, 0.00, 58000.00, false, NULL, NULL, '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', NULL, NULL, '2026-02-20 20:24:38.895-05', NULL, '904c9840-e259-4690-afe4-f88ee0eb1ea6', '8f85da84-2d29-4e13-9b83-ddbf5f6e8bea', 32000.00, 26000.00, 0.00, 0, NULL, NULL, '2026-02-20 20:24:38.895-05');
INSERT INTO public."Sale" (id, "siteId", "shiftId", "terminalId", status, subtotal, tax, total, "requiresElectronicInvoice", "electronicInvoiceNumber", "electronicInvoiceCode", "createdById", "approvedById", "approvedAt", "createdAt", "voidedAt", "cashSessionId", "customerId", "totalPaid", "balanceDue", "bonusTotal", "pointsEarned", "receiptNumber", "receiptText", "paidAt") VALUES ('90811722-2f8e-4e83-8a84-d62e4f767b4b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', 'c3a218a0-bead-452f-9cc7-af375f3895e8', 'PAID', 53000.00, 0.00, 53000.00, true, NULL, NULL, '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', NULL, NULL, '2026-02-20 20:14:58.325-05', NULL, '3072b5ea-692a-423d-b8b9-7a000c8699f1', '00000000-0000-0000-0000-000000000001', 55000.00, -2000.00, 15000.00, 50, NULL, NULL, '2026-02-20 20:14:58.325-05');
INSERT INTO public."Sale" (id, "siteId", "shiftId", "terminalId", status, subtotal, tax, total, "requiresElectronicInvoice", "electronicInvoiceNumber", "electronicInvoiceCode", "createdById", "approvedById", "approvedAt", "createdAt", "voidedAt", "cashSessionId", "customerId", "totalPaid", "balanceDue", "bonusTotal", "pointsEarned", "receiptNumber", "receiptText", "paidAt") VALUES ('07f1b53e-b8fb-4d2a-bbf8-f57928042015', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', 'c3a218a0-bead-452f-9cc7-af375f3895e8', 'PAID', 58000.00, 0.00, 58000.00, false, NULL, NULL, '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', NULL, NULL, '2026-02-20 20:24:58.341-05', NULL, '3072b5ea-692a-423d-b8b9-7a000c8699f1', '8f85da84-2d29-4e13-9b83-ddbf5f6e8bea', 58000.00, 0.00, 0.00, 0, NULL, NULL, '2026-02-20 20:24:58.341-05');
INSERT INTO public."Sale" (id, "siteId", "shiftId", "terminalId", status, subtotal, tax, total, "requiresElectronicInvoice", "electronicInvoiceNumber", "electronicInvoiceCode", "createdById", "approvedById", "approvedAt", "createdAt", "voidedAt", "cashSessionId", "customerId", "totalPaid", "balanceDue", "bonusTotal", "pointsEarned", "receiptNumber", "receiptText", "paidAt") VALUES ('7a95da5f-081d-46a7-862a-dac1ceb3a731', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '33abe9ce-fe90-4267-b1f3-14c95cd9cdee', 'b0955e24-b84a-4c54-8f11-761630059512', 'VOIDED', 3000.00, 0.00, 3000.00, false, NULL, NULL, '5375c31e-ccf5-42d8-a035-8ff51594a36e', '402d5332-87ec-47a4-a675-3adc1279dbab', '2026-02-19 21:17:58.35-05', '2026-02-19 21:14:58.35-05', '2026-02-19 21:17:58.35-05', '90e5e99a-1815-41e6-bb3e-b453fed1ae38', '8f85da84-2d29-4e13-9b83-ddbf5f6e8bea', 3000.00, 0.00, 0.00, 0, NULL, NULL, '2026-02-19 21:14:58.35-05');


--
-- Data for Name: Service; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Service" (id, "siteId", name, price, "isActive", "createdAt") VALUES ('c4d3e23a-67bc-4b0a-82ed-497d205474a8', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Cumpleaños Básico', 350000.00, true, '2026-02-20 20:14:38.848-05');
INSERT INTO public."Service" (id, "siteId", name, price, "isActive", "createdAt") VALUES ('9b1a3f61-1195-46a1-a664-dc2a955f9607', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Vacacional Semana', 220000.00, true, '2026-02-20 20:14:38.851-05');


--
-- Data for Name: ServiceSale; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."ServiceSale" (id, "siteId", "serviceId", "customerId", status, "totalAmount", "paidAmount", "createdAt", "updatedAt") VALUES ('9afb2213-c0f6-48e4-a2d6-161c456ae245', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'c4d3e23a-67bc-4b0a-82ed-497d205474a8', '00000000-0000-0000-0000-000000000001', 'PARTIAL', 350000.00, 150000.00, '2026-02-20 20:14:38.851-05', '2026-02-20 20:14:38.851-05');
INSERT INTO public."ServiceSale" (id, "siteId", "serviceId", "customerId", status, "totalAmount", "paidAmount", "createdAt", "updatedAt") VALUES ('02abce10-0b4e-4cfc-b79c-6ba944410529', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'c4d3e23a-67bc-4b0a-82ed-497d205474a8', '00000000-0000-0000-0000-000000000001', 'PARTIAL', 350000.00, 150000.00, '2026-02-20 20:14:58.31-05', '2026-02-20 20:14:58.31-05');


--
-- Data for Name: LedgerEvent; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."LedgerEvent" (id, "siteId", "shiftId", "saleId", "serviceSaleId", "eventType", description, "occurredAt", "createdById", "reversalOfId", "approvalId") VALUES ('c440b66d-72e8-408a-b564-31f1134f8866', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'c9dcb2cd-5981-4217-bb91-686acd9a95b6', NULL, '9afb2213-c0f6-48e4-a2d6-161c456ae245', 'SERVICE_PAYMENT', 'Abonos Cumpleaños Básico (ingreso diferido hasta prestación)', '2026-02-19 20:14:38.857-05', '5375c31e-ccf5-42d8-a035-8ff51594a36e', NULL, NULL);
INSERT INTO public."LedgerEvent" (id, "siteId", "shiftId", "saleId", "serviceSaleId", "eventType", description, "occurredAt", "createdById", "reversalOfId", "approvalId") VALUES ('6827177d-66c3-46a6-9b09-5ae6ab8801bf', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '9c2b5d7f-b758-48c2-95f6-9e0767067d81', '751c8497-e8f0-4c1f-9d39-b9f0f62f324d', NULL, 'SALE', 'Venta plástico + recarga 50k (bono 15k)', '2026-02-20 20:14:38.869-05', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', NULL, NULL);
INSERT INTO public."LedgerEvent" (id, "siteId", "shiftId", "saleId", "serviceSaleId", "eventType", description, "occurredAt", "createdById", "reversalOfId", "approvalId") VALUES ('66553486-6683-4146-b263-9717a6ef559d', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '33abe9ce-fe90-4267-b1f3-14c95cd9cdee', NULL, '02abce10-0b4e-4cfc-b79c-6ba944410529', 'SERVICE_PAYMENT', 'Abonos Cumpleaños Básico (ingreso diferido hasta prestación)', '2026-02-19 20:14:58.314-05', '5375c31e-ccf5-42d8-a035-8ff51594a36e', NULL, NULL);
INSERT INTO public."LedgerEvent" (id, "siteId", "shiftId", "saleId", "serviceSaleId", "eventType", description, "occurredAt", "createdById", "reversalOfId", "approvalId") VALUES ('1ec3a07c-c2c4-49b0-b26d-b699d0976225', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', '90811722-2f8e-4e83-8a84-d62e4f767b4b', NULL, 'SALE', 'Venta plástico + recarga 50k (bono 15k)', '2026-02-20 20:14:58.325-05', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', NULL, NULL);
INSERT INTO public."LedgerEvent" (id, "siteId", "shiftId", "saleId", "serviceSaleId", "eventType", description, "occurredAt", "createdById", "reversalOfId", "approvalId") VALUES ('7410d99c-7e13-42cd-8bce-4b26bdc6a9d4', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', '07f1b53e-b8fb-4d2a-bbf8-f57928042015', NULL, 'SALE', 'Venta snacks + souvenir', '2026-02-20 20:24:58.341-05', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', NULL, NULL);
INSERT INTO public."LedgerEvent" (id, "siteId", "shiftId", "saleId", "serviceSaleId", "eventType", description, "occurredAt", "createdById", "reversalOfId", "approvalId") VALUES ('a0013507-6e42-4ba9-8fdd-6bc9a6aed5a0', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '33abe9ce-fe90-4267-b1f3-14c95cd9cdee', '7a95da5f-081d-46a7-862a-dac1ceb3a731', NULL, 'SALE', 'Venta gift card (plástico)', '2026-02-19 21:14:58.35-05', '5375c31e-ccf5-42d8-a035-8ff51594a36e', NULL, NULL);
INSERT INTO public."LedgerEvent" (id, "siteId", "shiftId", "saleId", "serviceSaleId", "eventType", description, "occurredAt", "createdById", "reversalOfId", "approvalId") VALUES ('af80f584-be55-43db-b487-d3c4e737c8b1', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '33abe9ce-fe90-4267-b1f3-14c95cd9cdee', '7a95da5f-081d-46a7-862a-dac1ceb3a731', NULL, 'REVERSAL', 'Reverso por anulación venta gift card', '2026-02-19 21:17:58.35-05', '402d5332-87ec-47a4-a675-3adc1279dbab', 'a0013507-6e42-4ba9-8fdd-6bc9a6aed5a0', '191a0cfb-93ef-4e20-b61f-e7900a63ddf9');
INSERT INTO public."LedgerEvent" (id, "siteId", "shiftId", "saleId", "serviceSaleId", "eventType", description, "occurredAt", "createdById", "reversalOfId", "approvalId") VALUES ('5ffd09a5-6dcb-4a36-9d13-c2deb4edd118', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', NULL, NULL, 'CASH_WITHDRAWAL', 'Salida de efectivo a custodia', '2026-02-20 19:44:58.362-05', '402d5332-87ec-47a4-a675-3adc1279dbab', NULL, '8e884057-fcff-429e-805e-1b5dee254b26');
INSERT INTO public."LedgerEvent" (id, "siteId", "shiftId", "saleId", "serviceSaleId", "eventType", description, "occurredAt", "createdById", "reversalOfId", "approvalId") VALUES ('128f4c26-16b4-4277-b123-53f20c89c6cb', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', NULL, NULL, 'PRIZE_REDEMPTION', 'Redención premio (puntos)', '2026-02-20 19:59:58.367-05', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', NULL, 'e16f36dc-7bba-41de-8eae-d109b7cebd93');
INSERT INTO public."LedgerEvent" (id, "siteId", "shiftId", "saleId", "serviceSaleId", "eventType", description, "occurredAt", "createdById", "reversalOfId", "approvalId") VALUES ('d4cfbc4b-e352-408d-ba31-8b5a7031d7f7', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', NULL, NULL, 'ATTRACTION_USAGE', 'Uso atracción ARCADE-03', '2026-02-20 20:09:58.37-05', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', NULL, NULL);
INSERT INTO public."LedgerEvent" (id, "siteId", "shiftId", "saleId", "serviceSaleId", "eventType", description, "occurredAt", "createdById", "reversalOfId", "approvalId") VALUES ('fb07369e-d70d-46d3-a9c3-38b643ce334f', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', NULL, NULL, 'REVERSAL', 'Reverso uso atracción ARCADE-03', '2026-02-20 20:14:58.379-05', '402d5332-87ec-47a4-a675-3adc1279dbab', 'd4cfbc4b-e352-408d-ba31-8b5a7031d7f7', 'aaf74ef0-b4b0-4cc0-95b5-9d12bae2649f');


--
-- Data for Name: Reader; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('27345453-bd11-4789-b0c2-4c3eca1ba640', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '9feeaf10-7a07-4de7-a2a6-df3fbaa5a5fe', 'ARCADE-01-R1', 1, true, '2026-02-20 20:14:37.16-05', '$2a$10$XWL9WiCVxaXSHBHRMw0LjeaOp6K0StFq6eWG.pJo/OTBD8Z8aOGqO', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('4048768a-4b40-4691-bdbe-14f1686586fc', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '99c7fbc3-4056-4cd1-9a93-06c471f383fb', 'ARCADE-02-R1', 1, true, '2026-02-20 20:14:37.234-05', '$2a$10$l1Xe/.JKGew0PY7NDZh6VOSv.d5PDg3tQxzVd.Nw5f22ebL/7O8KC', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('9dd3b9a3-65d6-4845-8776-749e19ab7c1c', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '56a83ffa-4c62-4978-b41d-a9c8cd70ea32', 'ARCADE-03-R1', 1, true, '2026-02-20 20:14:37.306-05', '$2a$10$Xnw.5u2SH1hSJdRvhg.e1uzFYai0O2ls0esjhjVw4Qloof707ukUe', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('9af4ada1-4bed-465f-a52c-02ce72f91ba1', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '56a83ffa-4c62-4978-b41d-a9c8cd70ea32', 'ARCADE-03-R2', 2, true, '2026-02-20 20:14:37.377-05', '$2a$10$JbP5wZu2YDkK4j87iuVVHeRvvp/E6o5Fymsh8MQomCGGiEXAxLwQO', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('8c52961c-ff9d-4691-b7a8-e1378f9bd923', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'faa6e18f-399c-493a-b48b-c05a97740849', 'ARCADE-04-R1', 1, true, '2026-02-20 20:14:37.45-05', '$2a$10$phZEEaa9CKLPr5f28Kmz3eEEk3DeCzvMtEMKMLiy5ZPuPUPW383DW', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('c1398477-0f6c-4ba8-a973-f04c1b67d7f1', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'faa6e18f-399c-493a-b48b-c05a97740849', 'ARCADE-04-R2', 2, true, '2026-02-20 20:14:37.52-05', '$2a$10$v49Them./hyd3nDd9kJQ9O8W7BbfrbRNhtOI.dQVXT9ZTW8GMV34i', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('48a837f3-df7b-49eb-b72a-374670fa4472', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '93b4256c-24a1-47cc-ac13-15a6f8da55fa', 'ARCADE-05-R1', 1, true, '2026-02-20 20:14:37.592-05', '$2a$10$qw4p33TErlkOsn34T.nlTOgc4wX8izF4ZHgYYFnjd22qYhUPSA1PG', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('9c49f76c-2d4b-426a-8dfd-22c86bd35900', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '93b4256c-24a1-47cc-ac13-15a6f8da55fa', 'ARCADE-05-R2', 2, true, '2026-02-20 20:14:37.662-05', '$2a$10$7llwJfdAFNIWVAfUuJfrIej4fVJknyvava1oIz3JtakZioa9Tsos6', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('07c315d9-c2e0-49f4-b1aa-dbb6572800e9', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '9c1422ef-048b-4711-8a2c-942eb8f40e5d', 'ARCADE-06-R1', 1, true, '2026-02-20 20:14:37.734-05', '$2a$10$2zJRoRKShCj2fG73TUFLLutq2jSKC1AqdOAilFagl6xZAmSQk.kre', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('2a31a535-3cd3-4868-881c-518ff176d39e', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '9c1422ef-048b-4711-8a2c-942eb8f40e5d', 'ARCADE-06-R2', 2, true, '2026-02-20 20:14:37.805-05', '$2a$10$ho8tfrEZIT0z/YuM967Z5.dNsPaiWXeD2gW93JiG/Sjixo586lWoa', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('20afe6ae-f631-46c3-bc0e-b5943a81e5c3', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'c33d215e-c693-4992-b989-1d738a10a18d', 'ARCADE-07-R1', 1, true, '2026-02-20 20:14:37.88-05', '$2a$10$4xthF1L4XrBboXF6RVVmYunH3V3EMol.UpU6nJheF.RRzj0UKHsNG', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('e5a4a551-3ffa-451c-8883-f4f3dc9e039b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'eb091407-b4a2-44ac-add4-c8d798d19d20', 'ARCADE-08-R1', 1, true, '2026-02-20 20:14:37.956-05', '$2a$10$lt65FV30h7hdDyLNPDSKQuI.DFWfSkWVfh180VKqX1iLsF9W.ENBm', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('2d5fd354-3e33-47f7-b89b-577b7d1bcba2', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'a702b03f-7650-4798-a428-5f95251ade47', 'ARCADE-09-R1', 1, true, '2026-02-20 20:14:38.032-05', '$2a$10$G383CSkfLFcFYx9b0ERHPu6eBaYQelFRpnhpUiXKUZ4PaZMVqxNx6', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('9467f60f-29b9-4cbd-ab93-828573b19aff', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '97b20337-d80b-4f71-b7f9-88bdef02ca45', 'ARCADE-10-R1', 1, true, '2026-02-20 20:14:38.108-05', '$2a$10$EqfK19g.t.jTuJO4GtU/SeyyV2ucl0JSLun7f8fIq3VE2lf.mj4e6', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('50a7aa8e-e2b2-4425-861c-c64c2e7f01c2', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '52a6439e-ec4b-474a-a5e7-280a679e678f', 'ARCADE-11-R1', 1, true, '2026-02-20 20:14:38.183-05', '$2a$10$XYBNOym31QCrYIWv2x9/9u/6C51NllR7OEwL81sP6NwnBnfLj7s0S', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('4d8077c4-63c8-45e7-ab42-9114ddb58d84', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '812fb053-b7be-4a11-ba0e-437f9d89d5a3', 'PLAY-2-6-R1', 1, true, '2026-02-20 20:14:38.257-05', '$2a$10$M.vHE71F.f.ZslUEyPVJdO6IWK815M2sobE123zBbWbkV8HEQdKYe', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('3f5ce53c-3abf-4224-b998-c1b6e3ec458e', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'c8bebee9-9ef2-48c6-8dd4-6e3faafe4990', 'PLAY-6-12-R1', 1, true, '2026-02-20 20:14:38.33-05', '$2a$10$Fj3DfQTpqQaBAeCv3d.UaeH.xkFfmCBoniTECo7gWcA.yMEszSLgO', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('61c38a9d-c70e-456c-914b-fc7361e409bb', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '8cd9b82a-e455-4e46-b5aa-9d0f201eba45', 'VR-01-R1', 1, true, '2026-02-20 20:14:38.403-05', '$2a$10$fm/5fa4PzatyZOeMBTvk8ub9mZjURvzoniVgiRInVtqIU7Ye3bs8e', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('81417bd1-6e11-4814-9c0e-1d207fb20f1a', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'cc8ddcf3-71d9-4ba1-aa01-10f9a71da39f', 'VR-02-R1', 1, true, '2026-02-20 20:14:38.474-05', '$2a$10$Azgklw1KLcIyxttg2euQQ.u/VQKPtUu7toFFSqQnD0lWtXzRp.ab.', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('a908a626-67b9-429c-b6e1-4e5c58b70a81', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'b4804741-386b-46fa-9826-a4b5f341cc33', 'POLIROBO-R1', 1, true, '2026-02-20 20:14:38.545-05', '$2a$10$bCCXGuze7dEMupwOMcC4wO4byjDTtyFNn3YJcgE4J89weCaJARFAC', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('5fae761e-a6cd-439a-a853-515ba3b6601c', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'e0a8c2c7-baba-412a-bcf5-9865f2fddddb', 'EXTRA-01-R1', 1, true, '2026-02-20 20:14:38.616-05', '$2a$10$3xYmo6LKPdQUjeqVxBULxOTQ/EkmErjBK7dC9feGibVT5zMnee7ay', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('101f2615-fc4c-4276-b674-83f90b334188', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '47cdd65d-03ea-4122-bbe1-257871a73b57', 'EXTRA-02-R1', 1, true, '2026-02-20 20:14:38.687-05', '$2a$10$b3/b/WIdouCnimdpE/OyYe.KZSLioQ9Ze7mjsjmWu1k5kZIaR8VuO', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('981cd16c-d3d5-4b40-be82-ae9049219765', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'f432940b-92fe-4034-896a-8340d9a6b282', 'EXTRA-03-R1', 1, true, '2026-02-20 20:14:38.758-05', '$2a$10$VVjN6bi/e7i/U1iYz/DlDufEy29pEGLjP/o0UEItiTku8aQ426pWW', 'dev-esp-hmac-secret-123456', NULL);
INSERT INTO public."Reader" (id, "siteId", "attractionId", code, "position", "isActive", "createdAt", "apiTokenHash", "hmacSecret", "lastSeenAt") VALUES ('6d692e38-ce8e-4c2f-9610-47bcbbce3c27', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '5c77d432-0ba2-43ed-8d97-389e2b13bf7c', 'EXTRA-04-R1', 1, true, '2026-02-20 20:14:38.829-05', '$2a$10$jkFqON4GszHqL2oBXsp/b.lSlg8S8wWmA0BTf4oWbm8qINVlNe2Z2', 'dev-esp-hmac-secret-123456', NULL);


--
-- Data for Name: AttractionUsage; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."AttractionUsage" (id, "siteId", "cardId", "attractionId", "readerId", "playerIndex", type, cost, "occurredAt", "ledgerEventId", "reversalOfId", "performedById", "approvalId") VALUES (1, 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'a8cd692a-3532-4647-b0e7-8fdec16f415b', '56a83ffa-4c62-4978-b41d-a9c8cd70ea32', '9dd3b9a3-65d6-4845-8776-749e19ab7c1c', 1, 'USE', 4000.00, '2026-02-20 20:09:58.37-05', 'd4cfbc4b-e352-408d-ba31-8b5a7031d7f7', NULL, NULL, NULL);
INSERT INTO public."AttractionUsage" (id, "siteId", "cardId", "attractionId", "readerId", "playerIndex", type, cost, "occurredAt", "ledgerEventId", "reversalOfId", "performedById", "approvalId") VALUES (2, 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'a8cd692a-3532-4647-b0e7-8fdec16f415b', '56a83ffa-4c62-4978-b41d-a9c8cd70ea32', '9dd3b9a3-65d6-4845-8776-749e19ab7c1c', 1, 'REVERSAL', 4000.00, '2026-02-20 20:14:58.379-05', 'fb07369e-d70d-46d3-a9c3-38b643ce334f', 1, '402d5332-87ec-47a4-a675-3adc1279dbab', 'aaf74ef0-b4b0-4cc0-95b5-9d12bae2649f');


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('abd29522-47a9-4586-8f95-c687b4b66999', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '5375c31e-ccf5-42d8-a035-8ff51594a36e', 'CREATE', 'LEDGER_EVENT', 'c440b66d-72e8-408a-b564-31f1134f8866', NULL, '{"note": "Seed service payment ledger"}', NULL, '2026-02-20 20:14:38.865-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('af5f274f-8480-4616-a33c-57ba1be096ff', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'CREATE', 'SALE', '751c8497-e8f0-4c1f-9d39-b9f0f62f324d', NULL, '{"total": "53000.00", "status": "PAID"}', NULL, '2026-02-20 20:14:38.869-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('02afc2f9-b4cf-4915-a5e8-5245dd91c126', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'CREATE', 'CARD', 'a8cd692a-3532-4647-b0e7-8fdec16f415b', NULL, '{"reason": "Recarga con bono", "moneyDelta": "65000", "pointsDelta": 50}', NULL, '2026-02-20 20:14:38.869-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('e2dea875-2520-4542-9ae5-1041dad2fe20', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'CREATE', 'SALE', '7ee7993c-ed83-4925-b938-563455fa88f1', NULL, '{"total": "58000.00", "status": "PAID"}', NULL, '2026-02-20 20:24:38.895-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('2c696ce2-b17d-4ea6-9ecd-ffeab4e39070', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '5375c31e-ccf5-42d8-a035-8ff51594a36e', 'CREATE', 'LEDGER_EVENT', '66553486-6683-4146-b263-9717a6ef559d', NULL, '{"note": "Seed service payment ledger"}', NULL, '2026-02-20 20:14:58.321-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('87e38107-93fe-4201-a427-e651b4ce597b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'CREATE', 'SALE', '90811722-2f8e-4e83-8a84-d62e4f767b4b', NULL, '{"total": "53000.00", "status": "PAID"}', NULL, '2026-02-20 20:14:58.325-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('171e191d-49b3-4065-bf74-2208f026ac34', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'CREATE', 'CARD', 'a8cd692a-3532-4647-b0e7-8fdec16f415b', NULL, '{"reason": "Recarga con bono", "moneyDelta": "65000", "pointsDelta": 50}', NULL, '2026-02-20 20:14:58.325-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('df8e4232-9f1b-421a-9f67-b6b479494637', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'CREATE', 'SALE', '07f1b53e-b8fb-4d2a-bbf8-f57928042015', NULL, '{"total": "58000.00", "status": "PAID"}', NULL, '2026-02-20 20:24:58.341-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('fdd5aa2e-a61d-48a5-8734-615c1ff3893e', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '5375c31e-ccf5-42d8-a035-8ff51594a36e', 'CREATE', 'SALE', '7a95da5f-081d-46a7-862a-dac1ceb3a731', NULL, '{"total": "3000.00", "status": "PAID"}', NULL, '2026-02-19 21:14:58.35-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('e1e9a934-e81d-49fd-806b-aceb8f72f08b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '402d5332-87ec-47a4-a675-3adc1279dbab', 'VOID', 'SALE', '7a95da5f-081d-46a7-862a-dac1ceb3a731', '{"status": "PAID"}', '{"status": "VOIDED", "approvedById": "402d5332-87ec-47a4-a675-3adc1279dbab"}', 'Cliente desistió inmediatamente', '2026-02-19 21:17:58.35-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('42150c41-db12-4d08-bf38-1c8ba7b50908', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '402d5332-87ec-47a4-a675-3adc1279dbab', 'CREATE', 'LEDGER_EVENT', '5ffd09a5-6dcb-4a36-9d13-c2deb4edd118', NULL, '{"amount": "100000", "approvalId": "8e884057-fcff-429e-805e-1b5dee254b26"}', 'Bajar efectivo en caja', '2026-02-20 19:44:58.362-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('472092e5-e090-4212-9ded-5914f58d6f93', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '402d5332-87ec-47a4-a675-3adc1279dbab', 'REVERSE', 'ATTRACTION_USAGE', '1', NULL, '{"approvalId": "aaf74ef0-b4b0-4cc0-95b5-9d12bae2649f", "reversalUsageId": "2"}', 'Doble lectura detectada', '2026-02-20 20:14:58.379-05');
INSERT INTO public."AuditLog" (id, "siteId", "actorId", action, "entityType", "entityId", before, after, reason, "createdAt") VALUES ('9b47540b-db7c-4465-9382-b266b9d99d4e', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '402d5332-87ec-47a4-a675-3adc1279dbab', 'CLOSE', 'SHIFT', '8e7c3719-cec2-49da-b3ec-520ed60b7884', NULL, '{"status": "RECONCILED", "discrepancy": "0"}', NULL, '2026-02-18 05:14:58.393-05');


--
-- Data for Name: BonusScale; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."BonusScale" (id, "siteId", "minAmount", "maxAmount", "bonusAmount", "createdAt") VALUES ('ec96c4cd-db32-43e4-8cc6-866fe4050638', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 50000.00, 50000.00, 15000.00, '2026-02-20 20:14:37.017-05');
INSERT INTO public."BonusScale" (id, "siteId", "minAmount", "maxAmount", "bonusAmount", "createdAt") VALUES ('782c3382-69c3-431a-8dc0-1d1a6bf0eeba', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 70000.00, 70000.00, 20000.00, '2026-02-20 20:14:37.02-05');
INSERT INTO public."BonusScale" (id, "siteId", "minAmount", "maxAmount", "bonusAmount", "createdAt") VALUES ('d612a2d5-46ea-4f29-adac-b3bb7ac220f1', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 100000.00, 100000.00, 35000.00, '2026-02-20 20:14:37.021-05');


--
-- Data for Name: BonusApplied; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."BonusApplied" (id, "cardId", "saleId", "bonusScaleId", "bonusAmount", "createdAt") VALUES ('b9ec474a-321d-4699-972e-447372544604', 'a8cd692a-3532-4647-b0e7-8fdec16f415b', '751c8497-e8f0-4c1f-9d39-b9f0f62f324d', 'ec96c4cd-db32-43e4-8cc6-866fe4050638', 15000.00, '2026-02-20 20:14:38.892-05');
INSERT INTO public."BonusApplied" (id, "cardId", "saleId", "bonusScaleId", "bonusAmount", "createdAt") VALUES ('14d622da-20f9-4a85-b0de-8a629fb5b7fb', 'a8cd692a-3532-4647-b0e7-8fdec16f415b', '90811722-2f8e-4e83-8a84-d62e4f767b4b', 'ec96c4cd-db32-43e4-8cc6-866fe4050638', 15000.00, '2026-02-20 20:14:58.34-05');


--
-- Data for Name: CardBalanceEvent; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."CardBalanceEvent" (id, "cardId", "siteId", "ledgerEventId", "occurredAt", "moneyDelta", "pointsDelta", reason, "reversalOfId") VALUES ('8cd08b1c-aa7b-4689-9daa-94118075bbed', 'a8cd692a-3532-4647-b0e7-8fdec16f415b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '6827177d-66c3-46a6-9b09-5ae6ab8801bf', '2026-02-20 20:14:38.869-05', 65000.00, 50, 'Recarga con bono', NULL);
INSERT INTO public."CardBalanceEvent" (id, "cardId", "siteId", "ledgerEventId", "occurredAt", "moneyDelta", "pointsDelta", reason, "reversalOfId") VALUES ('3873d016-6e0b-4c05-b9d7-17a3a6c8b743', 'a8cd692a-3532-4647-b0e7-8fdec16f415b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '1ec3a07c-c2c4-49b0-b26d-b699d0976225', '2026-02-20 20:14:58.325-05', 65000.00, 50, 'Recarga con bono', NULL);
INSERT INTO public."CardBalanceEvent" (id, "cardId", "siteId", "ledgerEventId", "occurredAt", "moneyDelta", "pointsDelta", reason, "reversalOfId") VALUES ('06d039a2-4d70-4a03-9ce3-5d1925f12763', 'a8cd692a-3532-4647-b0e7-8fdec16f415b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '128f4c26-16b4-4277-b123-53f20c89c6cb', '2026-02-20 19:59:58.368-05', 0.00, -20, 'Redención premio: Pelota Saltarina', NULL);
INSERT INTO public."CardBalanceEvent" (id, "cardId", "siteId", "ledgerEventId", "occurredAt", "moneyDelta", "pointsDelta", reason, "reversalOfId") VALUES ('b643be53-fee0-4cfb-ae9f-6210ab8bd589', 'a8cd692a-3532-4647-b0e7-8fdec16f415b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'd4cfbc4b-e352-408d-ba31-8b5a7031d7f7', '2026-02-20 20:09:58.37-05', -4000.00, 0, 'Uso atracción ARCADE-03', NULL);
INSERT INTO public."CardBalanceEvent" (id, "cardId", "siteId", "ledgerEventId", "occurredAt", "moneyDelta", "pointsDelta", reason, "reversalOfId") VALUES ('7c356bbe-636c-4573-8d4e-33d620e1d5a8', 'a8cd692a-3532-4647-b0e7-8fdec16f415b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'fb07369e-d70d-46d3-a9c3-38b643ce334f', '2026-02-20 20:14:58.379-05', 4000.00, 0, 'Reverso uso atracción ARCADE-03', 'b643be53-fee0-4cfb-ae9f-6210ab8bd589');


--
-- Data for Name: CashCount; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."CashCount" (id, "cashSessionId", "siteId", type, denominations, "totalAmount", "countedByUserId", "createdAt") VALUES ('950859bf-4873-486c-a1be-0a7fb588fae0', '33f2c741-209e-41a0-abda-15d0670f0ac0', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'OPENING', '{"10000": 1, "20000": 3, "50000": 2, "100000": 1}', 200000.00, '5375c31e-ccf5-42d8-a035-8ff51594a36e', '2026-02-19 20:14:37.06-05');
INSERT INTO public."CashCount" (id, "cashSessionId", "siteId", type, denominations, "totalAmount", "countedByUserId", "createdAt") VALUES ('77eee3b6-a5da-4a29-9e14-818ab67c6181', '33f2c741-209e-41a0-abda-15d0670f0ac0', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'CLOSING', '{"5000": 4, "10000": 1, "20000": 6, "50000": 6}', 518000.00, '402d5332-87ec-47a4-a675-3adc1279dbab', '2026-02-20 04:14:37.06-05');
INSERT INTO public."CashCount" (id, "cashSessionId", "siteId", type, denominations, "totalAmount", "countedByUserId", "createdAt") VALUES ('41c5c167-3e61-41e0-a5eb-0ea2e9b0a7a0', '904c9840-e259-4690-afe4-f88ee0eb1ea6', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'OPENING', '{"5000": 2, "10000": 2, "20000": 2, "50000": 2}', 150000.00, '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', '2026-02-20 20:14:37.065-05');
INSERT INTO public."CashCount" (id, "cashSessionId", "siteId", type, denominations, "totalAmount", "countedByUserId", "createdAt") VALUES ('53f57c92-d2e4-4de0-bbe3-db29a7c36159', '90e5e99a-1815-41e6-bb3e-b453fed1ae38', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'OPENING', '{"10000": 1, "20000": 3, "50000": 2, "100000": 1}', 200000.00, '5375c31e-ccf5-42d8-a035-8ff51594a36e', '2026-02-19 20:14:56.538-05');
INSERT INTO public."CashCount" (id, "cashSessionId", "siteId", type, denominations, "totalAmount", "countedByUserId", "createdAt") VALUES ('7edb01f2-0eed-4df0-a731-7686b5b5af18', '90e5e99a-1815-41e6-bb3e-b453fed1ae38', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'CLOSING', '{"5000": 4, "10000": 1, "20000": 6, "50000": 6}', 518000.00, '402d5332-87ec-47a4-a675-3adc1279dbab', '2026-02-20 04:14:56.538-05');
INSERT INTO public."CashCount" (id, "cashSessionId", "siteId", type, denominations, "totalAmount", "countedByUserId", "createdAt") VALUES ('a8367f10-7c57-403b-af3b-0a34cce1b97e', '3072b5ea-692a-423d-b8b9-7a000c8699f1', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'OPENING', '{"5000": 2, "10000": 2, "20000": 2, "50000": 2}', 150000.00, '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', '2026-02-20 20:14:56.543-05');


--
-- Data for Name: CashMovement; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: DeviceLog; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: InventoryItem; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."InventoryItem" (id, "siteId", name, sku, category, "isActive", "createdAt", "updatedAt") VALUES ('417c6f0c-4923-464e-ae22-ca9351db2e16', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Tarjetas', 'INV-PTA-001', 'CARD_PLASTIC', true, '2026-02-20 20:14:37.051-05', '2026-02-20 20:14:56.531-05');
INSERT INTO public."InventoryItem" (id, "siteId", name, sku, category, "isActive", "createdAt", "updatedAt") VALUES ('95a3e9d1-c427-44cb-8f9b-af8cdd220bb1', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Pelota Saltarina', 'PRIZE-BALL', 'PRIZE', true, '2026-02-20 20:14:37.054-05', '2026-02-20 20:14:56.533-05');
INSERT INTO public."InventoryItem" (id, "siteId", name, sku, category, "isActive", "createdAt", "updatedAt") VALUES ('e846e0cf-deda-4d39-bd42-dd529be4906a', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Carro Mini', 'PRIZE-CAR', 'PRIZE', true, '2026-02-20 20:14:37.055-05', '2026-02-20 20:14:56.533-05');
INSERT INTO public."InventoryItem" (id, "siteId", name, sku, category, "isActive", "createdAt", "updatedAt") VALUES ('59a76daa-87b0-426e-9956-712980dfeb95', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Muñeco Pequeño', 'PRIZE-DOLL', 'PRIZE', true, '2026-02-20 20:14:37.056-05', '2026-02-20 20:14:56.534-05');
INSERT INTO public."InventoryItem" (id, "siteId", name, sku, category, "isActive", "createdAt", "updatedAt") VALUES ('4f45be61-95aa-45fd-801e-c485dff9d1d6', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Granizados 12ml', 'INV-SGR-001', 'SNACK', true, '2026-02-20 20:14:37.057-05', '2026-02-20 20:14:56.535-05');
INSERT INTO public."InventoryItem" (id, "siteId", name, sku, category, "isActive", "createdAt", "updatedAt") VALUES ('151bebbd-5436-4937-8409-bd7f357db999', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Crispetas', 'INV-SCR-001', 'SNACK', true, '2026-02-20 20:14:37.058-05', '2026-02-20 20:14:56.535-05');


--
-- Data for Name: InventoryMovement; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('62fc6c45-619c-4f74-adaa-9f290773c74e', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '417c6f0c-4923-464e-ae22-ca9351db2e16', 'c9dcb2cd-5981-4217-bb91-686acd9a95b6', '0b2b574d-5cbf-4afd-a91d-931c8e31a654', 'OPENING_COUNT', 200, 1500.00, '2026-02-13 20:14:37.079-05', 'Stock inicial tarjetas', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('8c2c6b4e-e07e-4384-96ff-4f2f08577c38', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '4f45be61-95aa-45fd-801e-c485dff9d1d6', 'c9dcb2cd-5981-4217-bb91-686acd9a95b6', '0b2b574d-5cbf-4afd-a91d-931c8e31a654', 'OPENING_COUNT', 120, 2500.00, '2026-02-13 20:14:37.079-05', 'Stock inicial granizados', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('e723d933-ced6-428f-b96a-5f2fa0742162', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '151bebbd-5436-4937-8409-bd7f357db999', 'c9dcb2cd-5981-4217-bb91-686acd9a95b6', '0b2b574d-5cbf-4afd-a91d-931c8e31a654', 'OPENING_COUNT', 80, 3000.00, '2026-02-13 20:14:37.079-05', 'Stock inicial crispetas', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('b9e51f70-b29a-4cc6-8731-9e975e9317a9', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '95a3e9d1-c427-44cb-8f9b-af8cdd220bb1', 'c9dcb2cd-5981-4217-bb91-686acd9a95b6', '0b2b574d-5cbf-4afd-a91d-931c8e31a654', 'OPENING_COUNT', 60, 4000.00, '2026-02-13 20:14:37.079-05', 'Stock inicial premios', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('a31d3f86-33d1-4685-9506-4c856c211cb2', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '4f45be61-95aa-45fd-801e-c485dff9d1d6', 'c9dcb2cd-5981-4217-bb91-686acd9a95b6', '402d5332-87ec-47a4-a675-3adc1279dbab', 'ADJUSTMENT', -2, 2500.00, '2026-02-18 20:14:37.079-05', 'Daño / merma', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('0419c299-3d49-4c04-860d-c8b7896c135a', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '4f45be61-95aa-45fd-801e-c485dff9d1d6', '9c2b5d7f-b758-48c2-95f6-9e0767067d81', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'SALE', -2, 2500.00, '2026-02-20 20:24:38.895-05', 'Venta snacks: Sale 7ee7993c-ed83-4925-b938-563455fa88f1', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('78d19fd6-65b9-4ac4-93c0-071faaf0b58f', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '151bebbd-5436-4937-8409-bd7f357db999', '9c2b5d7f-b758-48c2-95f6-9e0767067d81', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'SALE', -1, 3000.00, '2026-02-20 20:24:38.895-05', 'Venta snacks: Sale 7ee7993c-ed83-4925-b938-563455fa88f1', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('19d7e80d-6d43-4f45-ab44-b7ebeea73cfb', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '417c6f0c-4923-464e-ae22-ca9351db2e16', '33abe9ce-fe90-4267-b1f3-14c95cd9cdee', '0b2b574d-5cbf-4afd-a91d-931c8e31a654', 'OPENING_COUNT', 200, 1500.00, '2026-02-13 20:14:56.554-05', 'Stock inicial tarjetas', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('6db8b36c-e1d0-43ec-a36d-185d11b7364a', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '4f45be61-95aa-45fd-801e-c485dff9d1d6', '33abe9ce-fe90-4267-b1f3-14c95cd9cdee', '0b2b574d-5cbf-4afd-a91d-931c8e31a654', 'OPENING_COUNT', 120, 2500.00, '2026-02-13 20:14:56.554-05', 'Stock inicial granizados', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('e662a8aa-af0f-4e6a-8746-726132ec06de', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '151bebbd-5436-4937-8409-bd7f357db999', '33abe9ce-fe90-4267-b1f3-14c95cd9cdee', '0b2b574d-5cbf-4afd-a91d-931c8e31a654', 'OPENING_COUNT', 80, 3000.00, '2026-02-13 20:14:56.554-05', 'Stock inicial crispetas', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('88d4babf-1929-4857-b2d9-b8d94d921df8', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '95a3e9d1-c427-44cb-8f9b-af8cdd220bb1', '33abe9ce-fe90-4267-b1f3-14c95cd9cdee', '0b2b574d-5cbf-4afd-a91d-931c8e31a654', 'OPENING_COUNT', 60, 4000.00, '2026-02-13 20:14:56.554-05', 'Stock inicial premios', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('e99db62a-693c-4d1d-b09a-5dacf9d700dc', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '4f45be61-95aa-45fd-801e-c485dff9d1d6', '33abe9ce-fe90-4267-b1f3-14c95cd9cdee', '402d5332-87ec-47a4-a675-3adc1279dbab', 'ADJUSTMENT', -2, 2500.00, '2026-02-18 20:14:56.554-05', 'Daño / merma', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('d6f3ac2a-9422-4404-a479-93176757ad3d', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '4f45be61-95aa-45fd-801e-c485dff9d1d6', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'SALE', -2, 2500.00, '2026-02-20 20:24:58.341-05', 'Venta snacks: Sale 07f1b53e-b8fb-4d2a-bbf8-f57928042015', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('76ba6ec6-5913-45d9-83fd-9c072690c16e', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '151bebbd-5436-4937-8409-bd7f357db999', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'SALE', -1, 3000.00, '2026-02-20 20:24:58.341-05', 'Venta snacks: Sale 07f1b53e-b8fb-4d2a-bbf8-f57928042015', NULL);
INSERT INTO public."InventoryMovement" (id, "siteId", "itemId", "shiftId", "performedById", type, quantity, "unitCost", "occurredAt", notes, "approvalId") VALUES ('eafcb06d-b113-499c-a097-1644ccc580ca', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '95a3e9d1-c427-44cb-8f9b-af8cdd220bb1', '0f872e16-361d-4354-b1e9-f48f1d7cc0aa', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'REDEMPTION', -1, 4000.00, '2026-02-20 19:59:58.369-05', 'Entrega premio por puntos', 'e16f36dc-7bba-41de-8eae-d109b7cebd93');


--
-- Data for Name: LedgerEntry; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('7c1c093a-276a-4241-be5a-c6cbca478b73', 'c440b66d-72e8-408a-b564-31f1134f8866', 'CASH_ON_HAND', 'DEBIT', 50000.00, '2026-02-20 20:14:38.858-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('9befb74a-536e-4f1d-8250-f02db4cf5a75', 'c440b66d-72e8-408a-b564-31f1134f8866', 'BANK_TRANSFER', 'DEBIT', 100000.00, '2026-02-20 20:14:38.858-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('0d5d0791-d2cc-4ce3-b6d4-07f90d1c571e', 'c440b66d-72e8-408a-b564-31f1134f8866', 'DEFERRED_SERVICE_REVENUE', 'CREDIT', 150000.00, '2026-02-20 20:14:38.858-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('49662789-4e5a-4364-8fe8-9a6a6ab9b43b', '6827177d-66c3-46a6-9b09-5ae6ab8801bf', 'CASH_ON_HAND', 'DEBIT', 20000.00, '2026-02-20 20:14:38.885-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('498be193-4d4b-42f7-9ea2-d428d64b276f', '6827177d-66c3-46a6-9b09-5ae6ab8801bf', 'BANK_TRANSFER', 'DEBIT', 35000.00, '2026-02-20 20:14:38.885-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('2e18a8c8-2cad-4bcc-9f54-2c09f46d2067', '6827177d-66c3-46a6-9b09-5ae6ab8801bf', 'CARD_PLASTIC_REVENUE', 'CREDIT', 5000.00, '2026-02-20 20:14:38.885-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('34e02e26-3ea8-42d7-81fe-d34dc431edfe', '6827177d-66c3-46a6-9b09-5ae6ab8801bf', 'CARD_FLOAT_LIABILITY', 'CREDIT', 50000.00, '2026-02-20 20:14:38.885-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('283295d5-c341-4ef5-bf97-0b341a4f8cae', '66553486-6683-4146-b263-9717a6ef559d', 'CASH_ON_HAND', 'DEBIT', 50000.00, '2026-02-20 20:14:58.315-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('15116308-9021-41d5-ae5e-93ed982247da', '66553486-6683-4146-b263-9717a6ef559d', 'BANK_TRANSFER', 'DEBIT', 100000.00, '2026-02-20 20:14:58.315-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('8675c92c-b386-43c3-aad6-8b3130238ea7', '66553486-6683-4146-b263-9717a6ef559d', 'DEFERRED_SERVICE_REVENUE', 'CREDIT', 150000.00, '2026-02-20 20:14:58.315-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('2cbdfb95-ccbd-4284-a290-7de9d74f632d', '1ec3a07c-c2c4-49b0-b26d-b699d0976225', 'CASH_ON_HAND', 'DEBIT', 20000.00, '2026-02-20 20:14:58.336-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('4c304766-4922-4159-af01-3ff4060d0fdb', '1ec3a07c-c2c4-49b0-b26d-b699d0976225', 'BANK_TRANSFER', 'DEBIT', 35000.00, '2026-02-20 20:14:58.336-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('b94d5215-f536-4ca3-b9f9-07d0e19a8a49', '1ec3a07c-c2c4-49b0-b26d-b699d0976225', 'CARD_PLASTIC_REVENUE', 'CREDIT', 5000.00, '2026-02-20 20:14:58.336-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('c643d6cc-bf6a-40a9-9246-0863b94fb214', '1ec3a07c-c2c4-49b0-b26d-b699d0976225', 'CARD_FLOAT_LIABILITY', 'CREDIT', 50000.00, '2026-02-20 20:14:58.336-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('4315074d-8198-4f3c-b75d-f44a0b26229a', '7410d99c-7e13-42cd-8bce-4b26bdc6a9d4', 'CASH_ON_HAND', 'DEBIT', 30000.00, '2026-02-20 20:14:58.348-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('f0a59fcd-9431-458a-9a52-dbfa2c6e0402', '7410d99c-7e13-42cd-8bce-4b26bdc6a9d4', 'QR_PROVIDER', 'DEBIT', 28000.00, '2026-02-20 20:14:58.348-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('fee25466-d8dc-4690-82a8-20fe3834b3c1', '7410d99c-7e13-42cd-8bce-4b26bdc6a9d4', 'SNACKS_REVENUE', 'CREDIT', 58000.00, '2026-02-20 20:14:58.348-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('823600ed-af54-4ac0-a620-f313c61ae3bb', 'a0013507-6e42-4ba9-8fdd-6bc9a6aed5a0', 'CASH_ON_HAND', 'DEBIT', 3000.00, '2026-02-20 20:14:58.355-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('d1d5a12e-9e94-4275-b43a-c107097fbbfe', 'a0013507-6e42-4ba9-8fdd-6bc9a6aed5a0', 'CARD_PLASTIC_REVENUE', 'CREDIT', 3000.00, '2026-02-20 20:14:58.355-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('e005f39d-1837-4db6-acda-8bfe534f1486', 'af80f584-be55-43db-b487-d3c4e737c8b1', 'CARD_PLASTIC_REVENUE', 'DEBIT', 3000.00, '2026-02-20 20:14:58.361-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('f1aa1d32-70db-40a8-b31b-b5f328500c84', 'af80f584-be55-43db-b487-d3c4e737c8b1', 'CASH_ON_HAND', 'CREDIT', 3000.00, '2026-02-20 20:14:58.361-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('3ec46dc5-b32b-47e2-b425-35d20eb22678', '5ffd09a5-6dcb-4a36-9d13-c2deb4edd118', 'BANK_TRANSFER', 'DEBIT', 100000.00, '2026-02-20 20:14:58.364-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('741ba107-357a-483f-94c6-b32c93c7fad3', '5ffd09a5-6dcb-4a36-9d13-c2deb4edd118', 'CASH_ON_HAND', 'CREDIT', 100000.00, '2026-02-20 20:14:58.364-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('cf99e322-d435-409e-939b-bdfd434b2ecb', '128f4c26-16b4-4277-b123-53f20c89c6cb', 'POINTS_LIABILITY', 'DEBIT', 20.00, '2026-02-20 20:14:58.367-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('3bef25f3-07e2-4873-9c55-3955f2f51d03', '128f4c26-16b4-4277-b123-53f20c89c6cb', 'PRIZE_REVENUE', 'CREDIT', 20.00, '2026-02-20 20:14:58.367-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('2311cc09-5869-4bdd-894c-0fbee5c5665c', 'd4cfbc4b-e352-408d-ba31-8b5a7031d7f7', 'CARD_FLOAT_LIABILITY', 'DEBIT', 4000.00, '2026-02-20 20:14:58.37-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('ccf37739-cbc5-457f-b92b-8920d21086d4', 'd4cfbc4b-e352-408d-ba31-8b5a7031d7f7', 'POS_REVENUE', 'CREDIT', 4000.00, '2026-02-20 20:14:58.37-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('dd3dc4b1-0a73-4cd6-825b-6471cf03cf90', 'fb07369e-d70d-46d3-a9c3-38b643ce334f', 'POS_REVENUE', 'DEBIT', 4000.00, '2026-02-20 20:14:58.381-05');
INSERT INTO public."LedgerEntry" (id, "eventId", account, side, amount, "createdAt") VALUES ('729cb4d5-0b27-4ff9-a331-d0daa9e3fa55', 'fb07369e-d70d-46d3-a9c3-38b643ce334f', 'CARD_FLOAT_LIABILITY', 'CREDIT', 4000.00, '2026-02-20 20:14:58.381-05');


--
-- Data for Name: Product; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('7ed52690-6094-4221-948a-acc24db9da55', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Tarjetas', 'PTA-001', 'CARD_PLASTIC', 3000.00, true, '2026-02-20 20:14:37.022-05', '2026-02-20 20:14:56.508-05', 'Parque', 'Tarjetas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('3235b783-6e96-4b2f-a082-38f0e9234fd7', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Granizados 12ml', 'SGR-001', 'SNACKS', 10000.00, true, '2026-02-20 20:14:37.025-05', '2026-02-20 20:14:56.509-05', 'Snacks', 'Granizados');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('82d55711-ac98-481f-8cb6-5606daf95e46', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Granizados 16ml', 'SGR-002', 'SNACKS', 14000.00, true, '2026-02-20 20:14:37.026-05', '2026-02-20 20:14:56.51-05', 'Snacks', 'Granizados');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('dc1da768-4dca-4677-a8fb-a629f5590fd8', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Crispetas', 'SCR-001', 'SNACKS', 3000.00, true, '2026-02-20 20:14:37.027-05', '2026-02-20 20:14:56.511-05', 'Snacks', 'Crispetas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('1a10573f-4c9b-483b-a934-f07d8c10adb8', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Gomitas', 'SDU-001', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.028-05', '2026-02-20 20:14:56.512-05', 'Snacks', 'Dulces');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('ad40e26e-6c1c-4b9f-ba9a-dbb0d550d541', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Chocolatina 1', 'SDU-002', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.029-05', '2026-02-20 20:14:56.512-05', 'Snacks', 'Dulces');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('be926657-2684-4763-98b7-a281e934c212', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Chocolatina 2', 'SDU-003', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.029-05', '2026-02-20 20:14:56.513-05', 'Snacks', 'Dulces');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('63397154-2a89-4d4e-b9ef-8117d5022c17', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Chocolatina 3', 'SDU-004', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.03-05', '2026-02-20 20:14:56.513-05', 'Snacks', 'Dulces');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('2ff3b529-5c0e-4812-bcdf-fa551784a256', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Mekato 1', 'SME-001', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.031-05', '2026-02-20 20:14:56.514-05', 'Snacks', 'Mekatos');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('82df0846-bcaf-4893-b2c6-a7c68235e8c9', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Mekato 2', 'SME-002', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.031-05', '2026-02-20 20:14:56.514-05', 'Snacks', 'Mekatos');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('55f37982-2137-4ede-abdb-8c51c074d645', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Mekato 3', 'SME-003', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.032-05', '2026-02-20 20:14:56.515-05', 'Snacks', 'Mekatos');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('433ff66c-5567-46a6-9884-a4fe9be88199', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Mekato 4', 'SME-004', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.033-05', '2026-02-20 20:14:56.515-05', 'Snacks', 'Mekatos');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('0e6070c8-ebb9-4ef9-8a37-425a79a4670b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Mekato 5', 'SME-005', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.033-05', '2026-02-20 20:14:56.516-05', 'Snacks', 'Mekatos');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('d03af888-3395-4fe3-b4e2-31661d2b1f8b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Mekato 6', 'SME-006', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.034-05', '2026-02-20 20:14:56.516-05', 'Snacks', 'Mekatos');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('dfe4e03f-8bea-41a6-ac06-c2cdbb8fbb0e', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Mekato 7', 'SME-007', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.035-05', '2026-02-20 20:14:56.517-05', 'Snacks', 'Mekatos');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('69e9996d-bb18-49e5-86d1-4b2378631a6c', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Mekato 8', 'SME-008', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.036-05', '2026-02-20 20:14:56.517-05', 'Snacks', 'Mekatos');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('d3027e6a-a2ed-427d-856b-11fd2be64d1d', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Mekato 9', 'SME-009', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.036-05', '2026-02-20 20:14:56.518-05', 'Snacks', 'Mekatos');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('06389ed0-3a31-4d7e-a186-85b570d68821', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Mekato 10', 'SME-010', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.037-05', '2026-02-20 20:14:56.519-05', 'Snacks', 'Mekatos');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('2331cccb-9c3d-44df-b74d-2a3516ec73c5', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Gaseosa 1', 'SBE-001', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.038-05', '2026-02-20 20:14:56.519-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('68b0e58e-50d8-4e82-9ea8-cc493ecb0a39', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Gaseosa 2', 'SBE-002', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.039-05', '2026-02-20 20:14:56.52-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('164f49c2-b4bf-4c81-88da-15249538f5bd', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Gaseosa 3', 'SBE-003', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.039-05', '2026-02-20 20:14:56.52-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('910c9619-b73e-47b0-b88d-cb7b65def139', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Gaseosa 4', 'SBE-004', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.04-05', '2026-02-20 20:14:56.521-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('fec75f1c-fdbe-4f89-9b05-4e0850a13b29', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Gaseosa 5', 'SBE-005', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.041-05', '2026-02-20 20:14:56.521-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('602010b5-cfec-49f8-bd51-09732e35719c', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Agua 1', 'SBE-006', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.041-05', '2026-02-20 20:14:56.522-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('48555355-264d-465f-9435-df16e852f12a', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Agua 2', 'SBE-007', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.042-05', '2026-02-20 20:14:56.523-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('5434849f-0852-46b2-a616-0584a62528e1', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Agua 3', 'SBE-008', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.043-05', '2026-02-20 20:14:56.523-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('ef7a3db8-336e-4bcf-8ef2-a2dc84c9f870', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Agua 4', 'SBE-009', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.043-05', '2026-02-20 20:14:56.524-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('1bd534a4-94b1-41d3-a082-d8c818e69231', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Jugo 1', 'SBE-010', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.044-05', '2026-02-20 20:14:56.524-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('6e649245-43a4-427b-b24e-dbce3e76199a', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Jugo 2', 'SBE-011', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.045-05', '2026-02-20 20:14:56.525-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('fb382984-e471-4c0a-9307-318071a9cf9b', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Jugo 3', 'SBE-012', 'SNACKS', 0.00, true, '2026-02-20 20:14:37.045-05', '2026-02-20 20:14:56.526-05', 'Snacks', 'Bebidas');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('0dda8258-429b-4fb3-93ad-ec92272f8550', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Kit de Pintarte', 'SOV-001', 'SNACKS', 35000.00, true, '2026-02-20 20:14:37.046-05', '2026-02-20 20:14:56.526-05', 'Snacks', 'Otros Varios');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('37b2909c-5c60-4c5c-9279-ead58a223214', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Kit de Pinceladas', 'SOV-002', 'SNACKS', 50000.00, true, '2026-02-20 20:14:37.047-05', '2026-02-20 20:14:56.527-05', 'Snacks', 'Otros Varios');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('2124bff5-9519-4f45-8e3d-b8b5c7cd639f', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Granizado 12ml + Crispeta', 'SCO-001', 'SNACKS', 12000.00, true, '2026-02-20 20:14:37.047-05', '2026-02-20 20:14:56.527-05', 'Snacks', 'Combos');
INSERT INTO public."Product" (id, "siteId", name, sku, category, price, "isActive", "createdAt", "updatedAt", "analyticsCategory", "analyticsSubcategory") VALUES ('05ce420d-8ecc-45b3-a428-9414ec7391ce', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'Granizado 16ml + Crispeta + Chocolatina', 'SCO-002', 'SNACKS', 16000.00, true, '2026-02-20 20:14:37.048-05', '2026-02-20 20:14:56.528-05', 'Snacks', 'Combos');


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."Role" (id, name, "createdAt") VALUES ('b5fdf970-2c94-4929-9c08-9c1038e7c010', 'CASHIER', '2026-02-20 20:14:36.365-05');
INSERT INTO public."Role" (id, name, "createdAt") VALUES ('bc22470c-09bd-4f7f-9adb-91e9086747bd', 'SUPERVISOR', '2026-02-20 20:14:36.372-05');
INSERT INTO public."Role" (id, name, "createdAt") VALUES ('5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'ADMIN', '2026-02-20 20:14:36.373-05');


--
-- Data for Name: RolePermission; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('02c7a8aa-ec68-41dd-b2bf-b4b6436da7ec', 'b5fdf970-2c94-4929-9c08-9c1038e7c010', 'POS_SALE_CREATE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('b4b2704f-8179-4920-8f07-7160cd3637aa', 'b5fdf970-2c94-4929-9c08-9c1038e7c010', 'CASH_SHIFT_OPEN');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('5c53561a-e396-4790-ade4-8a3a80a0e310', 'b5fdf970-2c94-4929-9c08-9c1038e7c010', 'CASH_SHIFT_CLOSE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('27782d16-ca3a-4523-8ea2-b881b6e992a7', 'b5fdf970-2c94-4929-9c08-9c1038e7c010', 'CARD_ISSUE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('184ae666-cec9-4d49-9d83-f90eea65eac7', 'b5fdf970-2c94-4929-9c08-9c1038e7c010', 'CARD_RECHARGE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('66ba4381-123c-4d69-88ff-edf5c32db083', 'b5fdf970-2c94-4929-9c08-9c1038e7c010', 'PRIZE_REDEEM');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('05adc406-8695-4af8-aaa0-c6204a82e345', 'b5fdf970-2c94-4929-9c08-9c1038e7c010', 'SERVICE_SALE_CREATE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('000c798a-2f8f-441b-af07-a17687385176', 'b5fdf970-2c94-4929-9c08-9c1038e7c010', 'REPORTS_VIEW');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('9d043a89-4132-4526-8c74-5d5ba17dcfb6', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'POS_SALE_CREATE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('21f9ef29-05e8-433b-9a13-a26d98a2d315', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'CASH_SHIFT_OPEN');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('f34e8932-4973-42d5-8a2d-1db1debedeec', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'CASH_SHIFT_CLOSE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('81eab9c1-ff6e-4cbd-bcfe-d29e402e8119', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'CARD_ISSUE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('45027c56-887c-43b7-acbb-ab3abd0f09b1', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'CARD_RECHARGE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('af730363-a9e4-46bf-8a22-44e1cd221523', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'PRIZE_REDEEM');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('5a225325-14c8-4d85-af81-f853d450f0c4', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'SERVICE_SALE_CREATE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('1c61e1f4-aa41-4b51-b4b1-5bb143c841d4', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'REPORTS_VIEW');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('a19084f9-6226-4e00-9d0f-641de64bf007', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'POS_SALE_VOID');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('127e695e-e16f-4a94-a8bf-149efd03cf3c', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'POS_SALE_REFUND');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('8c8f92f1-020e-4838-96a7-f8e72b2a4df6', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'CASH_WITHDRAWAL_CREATE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('bb1b8f0a-13b2-4381-b5b6-e11627b53066', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'CARD_BLOCK');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('6a6f2f46-ff81-4f16-b37c-1e9d4b665c77', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'CARD_ADJUST');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('609e17a5-ef58-42d1-bb79-167b310408b7', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'POINTS_ADJUST');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('036a17ba-66f8-4979-a109-58534896a3e9', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'ATTRACTION_USAGE_REVERSE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('96357384-ad8d-4b49-bbc6-6236efbb62b1', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'INVENTORY_ADJUST');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('15d5b1af-b546-41a8-bb65-5608548e1d5e', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'SERVICE_SALE_ADJUST');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('7b39b700-b2b4-4847-97a8-fd636b5a58da', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', 'AUDIT_VIEW');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('4a0d2816-00b3-4947-a11e-51b277e78139', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'POS_SALE_CREATE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('5531dab7-0271-45e3-b44a-a0dcc0b22439', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'POS_SALE_VOID');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('d79f6eea-18ce-4f45-a1f3-9acfd1850737', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'POS_SALE_REFUND');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('8f531b56-feb5-4c9a-9210-9d885632a0ca', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'CASH_SHIFT_OPEN');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('12a6df08-bf65-4fb4-aa55-9eb6c43b1569', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'CASH_SHIFT_CLOSE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('475888c1-bc8d-483e-9668-4a90a833fba7', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'CASH_WITHDRAWAL_CREATE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('00a91eda-e948-4ed0-8861-2982b76ffd5f', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'CARD_ISSUE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('10830e9a-5cf9-42a6-982f-0063f3bf0ba5', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'CARD_BLOCK');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('43e63af1-f88d-42e4-b124-dc2d6a135df5', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'CARD_RECHARGE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('76a90b50-e78e-4389-bd0d-19ce345cd11b', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'CARD_ADJUST');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('54a4d12c-7ade-42be-9954-93b671010adf', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'POINTS_ADJUST');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('73a99b00-f179-476f-95aa-fb7cd0409306', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'ATTRACTION_USAGE_REVERSE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('101c39b7-b66c-457a-b60d-5c96e5e688c9', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'PRIZE_REDEEM');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('da988ce6-cf85-48fa-8d25-18f2c69ec909', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'INVENTORY_ADJUST');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('afb38323-9ed8-4a06-9b1e-a917d4ae410c', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'SERVICE_SALE_CREATE');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('2e6ee6ad-7543-46a8-b067-83e26abfeae1', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'SERVICE_SALE_ADJUST');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('f2344f97-7e34-46f1-b37d-01f9d3c3fa0c', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'REPORTS_VIEW');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('128190ee-b74d-46ff-96a8-c374f1a9055d', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'AUDIT_VIEW');
INSERT INTO public."RolePermission" (id, "roleId", permission) VALUES ('680bf64e-6530-41f6-b418-3e5d69bc5355', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', 'ADMIN_SETTINGS');


--
-- Data for Name: SaleLine; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."SaleLine" (id, "saleId", "productId", "cardId", category, quantity, "unitPrice", "lineTotal", metadata) VALUES ('cd49b855-8c2f-4d3b-a468-5471e2c5ba7a', '751c8497-e8f0-4c1f-9d39-b9f0f62f324d', '7ed52690-6094-4221-948a-acc24db9da55', NULL, 'CARD_PLASTIC', 1, 3000.00, 3000.00, '{"note": "Venta de plástico", "physicalCount": 1}');
INSERT INTO public."SaleLine" (id, "saleId", "productId", "cardId", category, quantity, "unitPrice", "lineTotal", metadata) VALUES ('6c9400a1-28f4-41bc-b784-dae36c1fb025', '751c8497-e8f0-4c1f-9d39-b9f0f62f324d', NULL, 'a8cd692a-3532-4647-b0e7-8fdec16f415b', 'RECHARGE', 1, 50000.00, 50000.00, '{"bonusApplied": "15000.00", "pointsEarned": 50, "rechargeBase": "50000.00"}');
INSERT INTO public."SaleLine" (id, "saleId", "productId", "cardId", category, quantity, "unitPrice", "lineTotal", metadata) VALUES ('f1383adb-d737-422c-91f1-dc5dca1f45e3', '7ee7993c-ed83-4925-b938-563455fa88f1', '3235b783-6e96-4b2f-a082-38f0e9234fd7', NULL, 'SNACKS', 2, 10000.00, 20000.00, NULL);
INSERT INTO public."SaleLine" (id, "saleId", "productId", "cardId", category, quantity, "unitPrice", "lineTotal", metadata) VALUES ('cef893ec-f8fa-427b-94a9-fadeef808f58', '7ee7993c-ed83-4925-b938-563455fa88f1', 'dc1da768-4dca-4677-a8fb-a629f5590fd8', NULL, 'SNACKS', 1, 3000.00, 3000.00, NULL);
INSERT INTO public."SaleLine" (id, "saleId", "productId", "cardId", category, quantity, "unitPrice", "lineTotal", metadata) VALUES ('4258fff3-e334-4110-a26f-ddce2d08224b', '7ee7993c-ed83-4925-b938-563455fa88f1', '0dda8258-429b-4fb3-93ad-ec92272f8550', NULL, 'SNACKS', 1, 35000.00, 35000.00, NULL);
INSERT INTO public."SaleLine" (id, "saleId", "productId", "cardId", category, quantity, "unitPrice", "lineTotal", metadata) VALUES ('de2fe473-a9fe-4af3-bd5c-c0672f0b3bd9', '90811722-2f8e-4e83-8a84-d62e4f767b4b', '7ed52690-6094-4221-948a-acc24db9da55', NULL, 'CARD_PLASTIC', 1, 3000.00, 3000.00, '{"note": "Venta de plástico", "physicalCount": 1}');
INSERT INTO public."SaleLine" (id, "saleId", "productId", "cardId", category, quantity, "unitPrice", "lineTotal", metadata) VALUES ('40582b44-b613-4219-a430-7c26d5409443', '90811722-2f8e-4e83-8a84-d62e4f767b4b', NULL, 'a8cd692a-3532-4647-b0e7-8fdec16f415b', 'RECHARGE', 1, 50000.00, 50000.00, '{"bonusApplied": "15000.00", "pointsEarned": 50, "rechargeBase": "50000.00"}');
INSERT INTO public."SaleLine" (id, "saleId", "productId", "cardId", category, quantity, "unitPrice", "lineTotal", metadata) VALUES ('0cce923f-a8fc-482f-a993-84c261b0c17c', '07f1b53e-b8fb-4d2a-bbf8-f57928042015', '3235b783-6e96-4b2f-a082-38f0e9234fd7', NULL, 'SNACKS', 2, 10000.00, 20000.00, NULL);
INSERT INTO public."SaleLine" (id, "saleId", "productId", "cardId", category, quantity, "unitPrice", "lineTotal", metadata) VALUES ('4762481e-3f87-4afa-b3c3-35174fee166a', '07f1b53e-b8fb-4d2a-bbf8-f57928042015', 'dc1da768-4dca-4677-a8fb-a629f5590fd8', NULL, 'SNACKS', 1, 3000.00, 3000.00, NULL);
INSERT INTO public."SaleLine" (id, "saleId", "productId", "cardId", category, quantity, "unitPrice", "lineTotal", metadata) VALUES ('19a75777-e3dd-465c-b870-5ce2b40652c5', '07f1b53e-b8fb-4d2a-bbf8-f57928042015', '0dda8258-429b-4fb3-93ad-ec92272f8550', NULL, 'SNACKS', 1, 35000.00, 35000.00, NULL);
INSERT INTO public."SaleLine" (id, "saleId", "productId", "cardId", category, quantity, "unitPrice", "lineTotal", metadata) VALUES ('b1860b0f-0a7d-429e-9b5d-73d0dbbe0398', '7a95da5f-081d-46a7-862a-dac1ceb3a731', '7ed52690-6094-4221-948a-acc24db9da55', NULL, 'CARD_PLASTIC', 1, 3000.00, 3000.00, NULL);


--
-- Data for Name: SalePayment; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."SalePayment" (id, "saleId", method, amount, reference, type, "createdAt") VALUES ('82d54e84-d6c1-47b0-a113-5b6f5740592c', '751c8497-e8f0-4c1f-9d39-b9f0f62f324d', 'CASH', 20000.00, NULL, 'PAYMENT', '2026-02-20 20:14:38.87-05');
INSERT INTO public."SalePayment" (id, "saleId", method, amount, reference, type, "createdAt") VALUES ('6a50ca30-523f-4f9a-b961-514ac8bc3580', '751c8497-e8f0-4c1f-9d39-b9f0f62f324d', 'TRANSFER', 35000.00, 'NEQUI-TRX-88921', 'PAYMENT', '2026-02-20 20:14:38.87-05');
INSERT INTO public."SalePayment" (id, "saleId", method, amount, reference, type, "createdAt") VALUES ('ef726685-adb3-437d-8a14-4b5e3bb9cba1', '7ee7993c-ed83-4925-b938-563455fa88f1', 'CASH', 10000.00, NULL, 'PAYMENT', '2026-02-20 20:14:38.896-05');
INSERT INTO public."SalePayment" (id, "saleId", method, amount, reference, type, "createdAt") VALUES ('aa91e4cc-2971-47e5-a5c7-562145dd88f9', '7ee7993c-ed83-4925-b938-563455fa88f1', 'QR', 22000.00, 'QR-CO-7712001', 'PAYMENT', '2026-02-20 20:14:38.896-05');
INSERT INTO public."SalePayment" (id, "saleId", method, amount, reference, type, "createdAt") VALUES ('4d7d2dcf-d3dc-4d0d-9ab3-2598e505d4fd', '90811722-2f8e-4e83-8a84-d62e4f767b4b', 'CASH', 20000.00, NULL, 'PAYMENT', '2026-02-20 20:14:58.326-05');
INSERT INTO public."SalePayment" (id, "saleId", method, amount, reference, type, "createdAt") VALUES ('c902438d-c232-41b5-b839-5498976d9ccf', '90811722-2f8e-4e83-8a84-d62e4f767b4b', 'TRANSFER', 35000.00, 'NEQUI-TRX-88921', 'PAYMENT', '2026-02-20 20:14:58.326-05');
INSERT INTO public."SalePayment" (id, "saleId", method, amount, reference, type, "createdAt") VALUES ('6907c67b-a025-4a8b-919a-2522ef24a155', '07f1b53e-b8fb-4d2a-bbf8-f57928042015', 'CASH', 30000.00, NULL, 'PAYMENT', '2026-02-20 20:14:58.342-05');
INSERT INTO public."SalePayment" (id, "saleId", method, amount, reference, type, "createdAt") VALUES ('1ce71873-2825-409b-94d5-217a43a3595a', '07f1b53e-b8fb-4d2a-bbf8-f57928042015', 'QR', 28000.00, 'QR-CO-7712001', 'PAYMENT', '2026-02-20 20:14:58.342-05');
INSERT INTO public."SalePayment" (id, "saleId", method, amount, reference, type, "createdAt") VALUES ('2d0dacb2-1b1a-4e1c-84ab-57e8a27bdb58', '7a95da5f-081d-46a7-862a-dac1ceb3a731', 'CASH', 3000.00, NULL, 'PAYMENT', '2026-02-20 20:14:58.351-05');


--
-- Data for Name: ServicePayment; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."ServicePayment" (id, "serviceSaleId", amount, method, "createdAt") VALUES ('f0d33b89-75f0-4e53-9f5c-6d1a25198f94', '9afb2213-c0f6-48e4-a2d6-161c456ae245', 100000.00, 'TRANSFER', '2026-02-18 20:14:38.854-05');
INSERT INTO public."ServicePayment" (id, "serviceSaleId", amount, method, "createdAt") VALUES ('d2dabce7-4f09-498e-b042-faca465fe0cb', '9afb2213-c0f6-48e4-a2d6-161c456ae245', 50000.00, 'CASH', '2026-02-19 20:14:38.854-05');
INSERT INTO public."ServicePayment" (id, "serviceSaleId", amount, method, "createdAt") VALUES ('0691b1ee-e67c-441f-a0b7-0fc881c6e863', '02abce10-0b4e-4cfc-b79c-6ba944410529', 100000.00, 'TRANSFER', '2026-02-18 20:14:58.312-05');
INSERT INTO public."ServicePayment" (id, "serviceSaleId", amount, method, "createdAt") VALUES ('2853001f-cf7d-4c56-98e6-09c1e75d0a42', '02abce10-0b4e-4cfc-b79c-6ba944410529', 50000.00, 'CASH', '2026-02-19 20:14:58.312-05');


--
-- Data for Name: SiteConfig; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."SiteConfig" (id, "siteId", "minRechargeAmount", "pointsPerCurrency", "currencyUnit", "createdAt", "updatedAt", "dailySalesGoal", "creditTermDays") VALUES ('a5e3f5be-1fd8-4277-8b44-4102eb2a4723', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 5000.00, 1, 1000, '2026-02-20 20:14:36.362-05', '2026-02-20 20:14:55.862-05', 3500000.00, 15);


--
-- Data for Name: UserAssignment; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."UserAssignment" (id, "userId", "siteId", "roleId", "isActive", "createdAt") VALUES ('dd28a9e9-f2b6-462b-a830-6f7d6bf13ab2', '0b2b574d-5cbf-4afd-a91d-931c8e31a654', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', '5c90d39c-e5eb-4820-9f8d-00697b6e5b3e', true, '2026-02-20 20:14:36.715-05');
INSERT INTO public."UserAssignment" (id, "userId", "siteId", "roleId", "isActive", "createdAt") VALUES ('26713e98-1aa7-490d-be67-34886972589d', '402d5332-87ec-47a4-a675-3adc1279dbab', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'bc22470c-09bd-4f7f-9adb-91e9086747bd', true, '2026-02-20 20:14:36.719-05');
INSERT INTO public."UserAssignment" (id, "userId", "siteId", "roleId", "isActive", "createdAt") VALUES ('9e6f18a5-2bc3-42c9-8bba-fd849d5f0f8d', '5375c31e-ccf5-42d8-a035-8ff51594a36e', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'b5fdf970-2c94-4929-9c08-9c1038e7c010', true, '2026-02-20 20:14:36.72-05');
INSERT INTO public."UserAssignment" (id, "userId", "siteId", "roleId", "isActive", "createdAt") VALUES ('575a8949-98d1-4769-9b0e-a35f7d7421f9', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', 'a1ee6668-b84b-4d74-adf8-24ab0a5844b2', 'b5fdf970-2c94-4929-9c08-9c1038e7c010', true, '2026-02-20 20:14:36.721-05');


--
-- Data for Name: UserAuthCode; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public."UserAuthCode" (id, "userId", "codeHash", "issuedAt", "expiresAt", "failedAttempts", "lockedUntil", "lastUsedAt") VALUES ('b8c2aba7-05df-4cab-bdb5-0bbf9d61d1f6', '0b2b574d-5cbf-4afd-a91d-931c8e31a654', '$2a$10$cuzIhzyRRHZETkSW0VyJGeCLUvg1XgPRCkCKQJ1zMdXcxD0Wpsf/6', '2026-02-20 20:14:56.287-05', '2026-03-22 20:14:56.286-05', 0, NULL, NULL);
INSERT INTO public."UserAuthCode" (id, "userId", "codeHash", "issuedAt", "expiresAt", "failedAttempts", "lockedUntil", "lastUsedAt") VALUES ('ab7ddac4-9a36-41ef-8db8-d2442029b92b', '402d5332-87ec-47a4-a675-3adc1279dbab', '$2a$10$gvcC83No9XnBi3ZiEyT5meA0hGX3EoCggWPWKJE0Ghypwdq1gOHJu', '2026-02-20 20:14:56.358-05', '2026-03-22 20:14:56.358-05', 0, NULL, NULL);
INSERT INTO public."UserAuthCode" (id, "userId", "codeHash", "issuedAt", "expiresAt", "failedAttempts", "lockedUntil", "lastUsedAt") VALUES ('bbb930c9-f246-4236-b4ad-e125b18e95f9', '5375c31e-ccf5-42d8-a035-8ff51594a36e', '$2a$10$h55eqdZiijW.MXkL9HyCEOpzZ.nA1xZgj9EolLbPK1UIMPYd1MzgC', '2026-02-20 20:14:56.429-05', '2026-03-22 20:14:56.428-05', 0, NULL, NULL);
INSERT INTO public."UserAuthCode" (id, "userId", "codeHash", "issuedAt", "expiresAt", "failedAttempts", "lockedUntil", "lastUsedAt") VALUES ('f9e432ff-32d5-4e0a-8db3-d190ff7cfb60', '514d26ed-9ec4-4db3-ab86-6b91301ef2dd', '$2a$10$8CEHqxJp8ap8gNMfxP.wQekaN2I2f9CHrq.WD8c1qwLk66hul7T.2', '2026-02-20 20:14:56.499-05', '2026-03-22 20:14:56.499-05', 0, NULL, NULL);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('60ee0c09-53dd-4e56-a1a2-ac96f7ecda79', '75df4584c3639dfbca385837fcd6aee172e0ff332ed4fdf98e4f556fa619dc32', '2026-02-20 20:13:23.808565-05', '20260131034002_init', NULL, NULL, '2026-02-20 20:13:23.719903-05', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('8fb34108-4d84-4f34-85de-1a6f931df64e', '026ea14fd482082156562e5a6b0edeb0a55c92609fe0f55dcbaf4d9a37cef2e9', '2026-02-20 20:13:23.813668-05', '20260131034537_auth_code', NULL, NULL, '2026-02-20 20:13:23.808831-05', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('6591c643-487d-471c-8295-3e46fb3eed15', '451c60879e9a63739156bfc8b67992e58f1b97ca46d855b36cccfe69d09b5c9e', '2026-02-20 20:13:23.826411-05', '20260131042049_cash_session_flow', NULL, NULL, '2026-02-20 20:13:23.814001-05', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('69b0d679-5ae7-4cf1-b011-7b55f0812816', '13dc502bf06d774e663ccffcf1cc18d265742192396d82dba00d548a3eb8dfa4', '2026-02-20 20:13:23.829786-05', '20260131061309_add_refresh_token', NULL, NULL, '2026-02-20 20:13:23.826739-05', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('fba79797-2ab5-4294-96e3-5a32363c59e5', '666b5930ee8d047a43c186c01e0b575bf5d692d25a72e5b247e3177f4ebb3bc8', '2026-02-20 20:13:23.874141-05', '20260131090308_admin_customer_receipt', NULL, NULL, '2026-02-20 20:13:23.830091-05', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('4d4809ba-fabd-4c64-8b27-b85c318c90dc', '33a4122cb0e2f03e5c70ba092a3a6ecdb4631e2984ce7909e01bc3546ea21ce9', '2026-02-20 20:13:23.87622-05', '20260204072343_v2', NULL, NULL, '2026-02-20 20:13:23.874416-05', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('b17bd62a-029c-4b16-be84-8c9305c52be6', 'fa73c8666117ea7aae1858b57839b6ed1c5b1a8ed298331e2830c5709378e59f', '2026-02-20 20:13:23.896964-05', '20260204075027_cash_movement_void', NULL, NULL, '2026-02-20 20:13:23.876437-05', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('7a9a1bcf-2c97-437a-b139-e3c1540b50f3', '9f8fd0ccb49168c7527c98937d9fa8b1d297e4140ccde2738f9c420a1ccd73c1', '2026-02-20 20:13:23.93037-05', '20260204214902_esp_device_logs', NULL, NULL, '2026-02-20 20:13:23.90153-05', 1);
INSERT INTO public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES ('97522bab-b656-4d7f-b4be-f0014d7f1e0a', '451a8de4da31f7158f7f99a5dbc5bac443c41e509e6ca168e2843a49dddf547d', '2026-02-20 20:13:23.933224-05', '20260212120000_supervisor_analytics', NULL, NULL, '2026-02-20 20:13:23.930729-05', 1);


--
-- Name: AttractionUsage_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public."AttractionUsage_id_seq"', 2, true);


--
-- PostgreSQL database dump complete
--

\unrestrict TkXZPt3YH1ERGVqvPpXUHbDnQ78mE69c0PGok9mBbchGLajnotsPc6SrPujzaWQ

