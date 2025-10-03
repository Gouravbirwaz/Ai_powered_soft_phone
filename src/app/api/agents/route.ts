
import { NextRequest, NextResponse } from 'next/server';

// This is a mock response based on the data structure the frontend expects.
// The user's provided backend code does not have an endpoint to list all agents.
// This mock will allow the application to function.
const mockAgents = {
  agents: [
    {
      id: 104,
      name: "Amit",
      email: "amit@example.com",
      phone: "+919911223344",
      status: "active",
    },
    {
      id: 105,
      name: "Gourav",
      email: "gourav@gmail.com",
      phone: "+919141017165",
      status: "active",
    }
  ],
  status: "success",
  total: 2
};


export async function GET(req: NextRequest) {
  // We will return the mock data directly instead of proxying the request
  // to a non-existent backend endpoint.
  return NextResponse.json(mockAgents);
}
