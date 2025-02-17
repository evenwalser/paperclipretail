// lib/squarePayment.ts

export interface SquarePaymentResult {
    payments: any; // Ideally, replace 'any' with the appropriate type from Square docs
    tapToPay: any;
  }
  
  export async function initializeSquarePayment(): Promise<SquarePaymentResult | null> {
    if (!window.Square) {
      console.error("Square SDK not loaded");
      return null;
    }
    try {
      const applicationId = "sandbox-sq0idb-MznhxwL5h9lpCPIK3ulcuA"; // Your Sandbox Application ID
      const locationId = "EAAAl-_CGgryPOtBmU6-vDo66dltkiiqokyMvDql-NPvV79164p92WeGMDq6pEFc"; // Your Sandbox Location ID
  
      const payments = await window.Square.payments(applicationId, locationId);
      const tapToPay = await payments.tapToPay();
      return { payments, tapToPay };
    } catch (error) {
      console.error("Failed to initialize Square payments:", error);
      return null;
    }
  }
  