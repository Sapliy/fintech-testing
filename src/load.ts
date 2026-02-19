import { SapliyClient } from "@sapliyio/fintech";

/**
 * Basic Load Testing Utility
 * 
 * Simulates concurrent traffic to basic endpoints to benchmark performance.
 */
export async function runLoadTest(concurrency: number, durationSeconds: number) {
    const client = new SapliyClient('sk_test_load_test', { basePath: 'http://localhost:8080' });
    void client;
    const endTime = Date.now() + durationSeconds * 1000;

    let totalRequests = 0;
    let successfulRequests = 0;
    const errors: Record<string, number> = {};

    const worker = async () => {
        while (Date.now() < endTime) {
            totalRequests++;
            try {
                // Perform a simple read operation (Health check or similar)
                const res = await fetch('http://localhost:8080/health');
                if (res.ok) {
                    successfulRequests++;
                } else {
                    const status = res.status.toString();
                    errors[status] = (errors[status] || 0) + 1;
                }
            } catch (e) {
                const msg = (e as Error).message;
                errors[msg] = (errors[msg] || 0) + 1;
            }
        }
    };

    console.log(`Starting load test: concurrency=${concurrency}, duration=${durationSeconds}s`);
    const start = Date.now();
    await Promise.all(Array.from({ length: concurrency }).map(() => worker()));
    const elapsed = (Date.now() - start) / 1000;

    console.log(`--- Load Test Results ---`);
    console.log(`Total Requests: ${totalRequests}`);
    console.log(`Success Rate: ${((successfulRequests / totalRequests) * 100).toFixed(2)}%`);
    console.log(`Throughput: ${(totalRequests / elapsed).toFixed(2)} req/s`);
    if (Object.keys(errors).length > 0) {
        console.log(`Errors:`, errors);
    }
}

// If run directly via ts-node or similar
if (require.main === module) {
    runLoadTest(10, 5).catch(console.error);
}
